import { NextResponse } from "next/server";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  checkoutSchema,
  computeShipping,
} from "@stickypie/shared";
import { createCfOrder } from "@/lib/cashfree";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured, cashfreeEnv, paymentSimulatorAllowed, siteUrl } from "@/lib/mode";
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

  // Merge duplicate product ids, then re-price everything server-side.
  const qtyById = new Map<string, number>();
  for (const item of items) {
    qtyById.set(item.productId, (qtyById.get(item.productId) ?? 0) + item.quantity);
  }

  const driver = getDriver();
  const products = await driver.getProductsByIds([...qtyById.keys()]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const orderItems: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    imageUrl: string;
  }> = [];
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
    orderItems.push({
      productId,
      name: product.name,
      unitPrice: product.price,
      quantity,
      imageUrl: product.imageUrl,
    });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = computeShipping(subtotal, FREE_SHIPPING_THRESHOLD, SHIPPING_FEE);
  const total = subtotal + shippingFee;
  const provider = cashfreeConfigured() ? "cashfree" : "simulator";

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
