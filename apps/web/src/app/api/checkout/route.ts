import { NextResponse } from "next/server";
import {
  belowMinimum,
  checkoutSchema,
  formatINR,
  shippingFor,
  priceForSize,
  sizeLabel,
  type NewOrderInput,
  type Order,
} from "@stickypie/shared";
import { CF_ORDER_TTL_MINUTES, createCfOrder, getCfOrder } from "@/lib/cashfree";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured, cashfreeEnv, paymentSimulatorAllowed, siteUrl } from "@/lib/mode";
import { reconcileOrderPayment } from "@/lib/payments";
import { accountsEnabled, shopperFromRequest } from "@/lib/shopper";

export async function POST(req: Request) {
  if (!cashfreeConfigured() && !paymentSimulatorAllowed()) {
    console.error("[checkout] Cashfree keys are not configured on the production site.");
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

  // Merge duplicate lines (same product + size), then re-price everything server-side.
  const lines = new Map<string, { productId: string; size: number | null; quantity: number }>();
  for (const item of items) {
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

  const driver = getDriver();
  const products = await driver.getProductsByIds([...qtyById.keys()]);
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

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const settings = await driver.getSettings();
  const shortBy = belowMinimum(settings, subtotal);
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
  const total = subtotal + shippingFee;
  const provider = cashfreeConfigured() ? "cashfree" : "simulator";

  // Same cart submitted again while an earlier attempt is still payable
  // (double click, back from Cashfree, second tab): reuse that order and its
  // Cashfree session instead of creating a second one that could also be paid.
  if (provider === "cashfree" && userId) {
    const since = new Date(Date.now() - (CF_ORDER_TTL_MINUTES - 5) * 60_000).toISOString();
    const sameCart = (o: Order) =>
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
    const earlier = (await driver.listPendingOrdersForUser(userId, since)).filter(sameCart);
    for (const existing of earlier) {
      try {
        const cf = await getCfOrder(existing.id);
        if (cf.order_status === "PAID") {
          await reconcileOrderPayment(existing);
          return NextResponse.json({ mode: "paid", url: `/order/${existing.id}` });
        }
        if (cf.order_status === "ACTIVE" && cf.payment_session_id) {
          return NextResponse.json({
            mode: "cashfree",
            cfMode: cashfreeEnv(),
            paymentSessionId: cf.payment_session_id,
          });
        }
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
    total,
    paymentProvider: provider,
    userId,
  });

  if (provider === "simulator") {
    return NextResponse.json({ mode: "simulator", url: `/pay/simulator?order=${order.id}` });
  }

  try {
    const cf = await createCfOrder({
      orderId: order.id,
      amount: total,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      returnUrl: `${siteUrl()}/order/${order.id}`,
      notifyUrl: `${siteUrl()}/api/webhooks/cashfree`,
    });
    await driver.setCfOrderId(order.id, String(cf.cf_order_id ?? order.id));
    if (!cf.payment_session_id) throw new Error("Cashfree did not return a payment session");
    return NextResponse.json({
      mode: "cashfree",
      cfMode: cashfreeEnv(),
      paymentSessionId: cf.payment_session_id,
    });
  } catch (err) {
    console.error("[checkout] Cashfree order creation failed:", err);
    await driver
      .markOrderFailed(order.id, err instanceof Error ? err.message : "Gateway error")
      .catch(() => {});
    return NextResponse.json(
      { error: "Payment gateway error. Please try again in a moment." },
      { status: 502 }
    );
  }
}
