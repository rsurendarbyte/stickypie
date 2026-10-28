import { NextResponse } from "next/server";
import {
  AVATAR_STICKER_NAME,
  CUSTOM_STICKER_NAME,
  QR_STICKER_NAME,
  TEXT_STICKER_NAME,
  formatInches,
  belowMinimum,
  checkoutSchema,
  avatarBook,
  avatarBookLabel,
  avatarMaxSheets,
  avatarSheetsPrice,
  customSizeLabel,
  customSizes,
  isCustomProductId,
  gstOnTop,
  formatINR,
  shippingFor,
  priceForSize,
  sizeLabel,
  type NewOrderInput,
  type Order,
} from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { checkIndianAddress } from "@/lib/india-address";
import { cashfreeConfigured, checkoutGateway, paymentSimulatorAllowed, razorpayConfigured } from "@/lib/mode";
import { openNewPayment, reopenPayment, reuseWindowStart } from "@/lib/pay-session";
import { accountsEnabled, shopperFromRequest } from "@/lib/shopper";

export async function POST(req: Request) {
  if (!cashfreeConfigured() && !razorpayConfigured() && !paymentSimulatorAllowed()) {
    console.error("[checkout] No payment gateway keys are configured on the production site.");
    return NextResponse.json(
      { error: "Payments are temporarily unavailable. Please try again soon." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Invalid input" }, { status: 400 });
  }
  // Orders are placed from a shopper account (demo mode stays guest-only).
  let userId: string | null = null;
  let customer = parsed.data.customer;
  const { items } = parsed.data;
  if (accountsEnabled()) {
    const shopper = await shopperFromRequest(req);
    if (!shopper) {
      return NextResponse.json(
        { error: "Please sign in to place your order.", code: "auth_required" },
        { status: 401 }
      );
    }
    userId = shopper.id;
    customer = { ...customer, email: shopper.email };
  }

  // India only: the PIN must be a real Indian PIN in the chosen state.
  const where = await checkIndianAddress(customer.pincode, customer.state);
  if (!where.ok) {
    return NextResponse.json({ error: where.error, code: "outside_india" }, { status: 400 });
  }

  const driver = getDriver();
  const settings = await driver.getSettings();

  // Custom stickers (artwork uploaded after payment) are priced per size from
  // admin → Settings. One order line per design, so each keeps its own artwork.
  const customItems = items.filter((item) => isCustomProductId(item.productId));
  // Custom and regular stickers can share one order: regular lines are priced
  // from the catalogue below, custom lines from these per-size prices, and the
  // order page asks for the custom artwork once it's paid.
  const customPrice = new Map(customSizes(settings.customPrices).map((s) => [s.inches, s.price]));
  const qrPrice = new Map(customSizes(settings.qrPrices).map((s) => [s.inches, s.price]));
  const textPrice = new Map(customSizes(settings.textPrices).map((s) => [s.inches, s.price]));
  // Avatar sticker sheets: one sheet per style (from the admin's list), at least
  // the minimum, priced per sheet.
  const book = avatarBook(settings);
  const styleNames = new Set(settings.avatarStyles.map((s) => s.label));
  const priceFor = (item: (typeof customItems)[number]) => {
    if (item.customKind === "avatar") {
      const spec = item.customSpec?.kind === "avatar" ? item.customSpec : null;
      const sheets = spec?.styles.length ?? 0;
      const fits =
        book &&
        spec?.pages === sheets &&
        sheets >= book.pages &&
        sheets <= avatarMaxSheets(styleNames.size) &&
        new Set(spec.styles).size === sheets &&
        spec.styles.every((s) => styleNames.has(s));
      return fits ? avatarSheetsPrice(book, sheets) : undefined;
    }
    return (item.customKind === "qr" ? qrPrice : item.customKind === "text" ? textPrice : customPrice).get(item.size ?? -1);
  };
  for (const item of customItems) {
    // QR / name stickers carry what to draw instead of an uploaded image;
    // avatar books carry the page styles (the photo follows after paying).
    const drawn = item.customKind === "qr" || item.customKind === "text" || item.customKind === "avatar";
    if (drawn && item.customSpec?.kind !== item.customKind) {
      return NextResponse.json(
        { error: "Please make your custom sticker again — its details are missing.", code: "spec_missing" },
        { status: 409 }
      );
    }
    if ((item.size == null && item.customKind !== "avatar") || priceFor(item) === undefined) {
      return NextResponse.json(
        {
          error:
            item.customKind === "avatar"
              ? "The avatar sticker packs have changed. Please pick your styles again."
              : "A custom sticker size in your cart is no longer offered. Please choose a size again.",
          code: "size_unavailable",
        },
        { status: 409 }
      );
    }
  }

  // Merge duplicate lines (same product + size), then re-price everything server-side.
  const lines = new Map<string, { productId: string; size: number | null; quantity: number }>();
  for (const item of items) {
    if (customItems.includes(item)) continue;
    const size = item.size ?? null;
    const key = `${item.productId}:${size ?? ""}`;
    const line = lines.get(key) ?? { productId: item.productId, size, quantity: 0 };
    line.quantity += item.quantity;
    lines.set(key, line);
  }
  // Stock is shared by every size of a sticker.
  const qtyById = new Map<string, number>();
  for (const line of lines.values()) {
    qtyById.set(line.productId, (qtyById.get(line.productId) ?? 0) + line.quantity);
  }

  const products = qtyById.size ? await driver.getProductsByIds([...qtyById.keys()]) : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const [productId, quantity] of qtyById) {
    const product = byId.get(productId);
    if (!product || !product.isActive) {
      return NextResponse.json(
        { error: "Some items in your cart are no longer available. Please review your cart." },
        { status: 409 }
      );
    }
    if (product.stock !== null && product.stock < quantity) {
      return NextResponse.json(
        {
          error:
            product.stock === 0
              ? `"${product.name}" just sold out. Please remove it from your cart.`
              : `Only ${product.stock} × "${product.name}" left. Please update your cart.`,
        },
        { status: 409 }
      );
    }
  }

  const orderItems: NewOrderInput["items"] = [];
  for (const line of lines.values()) {
    const product = byId.get(line.productId)!;
    const priced = priceForSize(product, line.size);
    if (!priced) {
      return NextResponse.json(
        {
          error: `The size you picked for "${product.name}" is no longer available. Please choose a size again.`,
          code: "size_unavailable",
        },
        { status: 409 }
      );
    }
    orderItems.push({
      productId: line.productId,
      name: product.name,
      unitPrice: priced.price,
      quantity: line.quantity,
      imageUrl: product.imageUrl,
      sizeInches: line.size,
      sizeLabel: line.size == null ? null : sizeLabel(line.size, product.aspectRatio),
    });
  }

  for (const item of customItems) {
    orderItems.push({
      productId: null,
      name:
        item.customKind === "qr"
          ? QR_STICKER_NAME
          : item.customKind === "text"
            ? TEXT_STICKER_NAME
            : item.customKind === "avatar"
              ? AVATAR_STICKER_NAME
              : CUSTOM_STICKER_NAME,
      unitPrice: priceFor(item)!,
      quantity: item.quantity,
      imageUrl: "",
      sizeInches: item.customKind === "avatar" ? null : item.size!,
      sizeLabel:
        item.customKind === "qr"
          ? `${formatInches(item.size!)}″ QR code sticker — longest side ${formatInches(item.size!)} in`
          : item.customKind === "text"
            ? `${formatInches(item.size!)}″ name sticker — longest side ${formatInches(item.size!)} in`
            : item.customKind === "avatar" && item.customSpec?.kind === "avatar"
              ? avatarBookLabel(item.customSpec.pages, !!item.customSpec.couple)
              : customSizeLabel(item.size!),
      isCustom: true,
      customRef: item.customRef ?? null,
      customSpec:
        item.customKind === "qr" || item.customKind === "text" || item.customKind === "avatar"
          ? (item.customSpec ?? null)
          : null,
    });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shortBy = belowMinimum(settings, subtotal, orderItems);
  if (shortBy > 0) {
    return NextResponse.json(
      {
        error: `Minimum order is ${formatINR(settings.minOrder)} — add ${formatINR(shortBy)} more to check out.`,
        code: "min_order",
      },
      { status: 400 }
    );
  }
  // Always charged, by distance from the dispatch PIN code (zones set in the admin).
  const shippingFee = shippingFor(settings, customer.pincode, customer.state).fee;
  // GST is added on top of sticker prices + shipping (rate from admin → Settings).
  const gst = gstOnTop(settings, subtotal, shippingFee);
  const total = subtotal + shippingFee + gst.amount;
  // Gateway picked in admin → Settings (falls back to whichever has keys).
  const provider = checkoutGateway(settings.paymentGateway) ?? "simulator";

  // Same cart submitted again while an earlier attempt is still payable
  // (double click, back from the gateway, second tab): reuse that order and
  // its gateway payment instead of creating a second one that could also be paid.
  if (provider !== "simulator" && userId) {
    const sameCart = (o: Order) =>
      o.paymentProvider === provider &&
      o.total === total &&
      o.items.length === orderItems.length &&
      orderItems.every((i) =>
        o.items.some(
          (x) =>
            x.productId === i.productId &&
            (x.sizeInches ?? null) === i.sizeInches &&
            x.quantity === i.quantity &&
            x.unitPrice === i.unitPrice
        )
      );
    const earlier = (await driver.listPendingOrdersForUser(userId, reuseWindowStart(provider))).filter(sameCart);
    for (const existing of earlier) {
      try {
        const session = await reopenPayment(existing);
        if (session) return NextResponse.json(session);
      } catch (err) {
        console.error("[checkout] could not reuse order", existing.id, err);
      }
    }
  }

  const order = await driver.createOrder({
    customer,
    items: orderItems,
    subtotal,
    shippingFee,
    gstAmount: gst.amount,
    gstRate: gst.rate,
    total,
    paymentProvider: provider,
    userId,
  });

  if (provider === "simulator") {
    return NextResponse.json({ mode: "simulator", url: `/pay/simulator?order=${order.id}` });
  }

  try {
    return NextResponse.json(await openNewPayment(order));
  } catch (err) {
    console.error(`[checkout] ${provider} order creation failed:`, err);
    await driver
      .markOrderFailed(order.id, err instanceof Error ? err.message : "Gateway error")
      .catch(() => {});
    return NextResponse.json(
      { error: "Payment gateway error. Please try again in a moment." },
      { status: 502 }
    );
  }
}
