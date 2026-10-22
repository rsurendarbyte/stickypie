import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured, razorpayConfigured } from "@/lib/mode";
import { reopenPayment } from "@/lib/pay-session";
import { accountsEnabled, shopperFromRequest } from "@/lib/shopper";

const bodySchema = z.object({ orderId: z.string().uuid() });

/**
 * "Pay now" on an unpaid order: reopens the SAME gateway payment (Cashfree
 * session or Razorpay order) — never a new one, so the shopper can't end up
 * paying twice. Once the payment window has closed the order is marked
 * failed and they check out again.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const driver = getDriver();
  const order = await driver.getOrder(parsed.data.orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (accountsEnabled() && order.userId) {
    const shopper = await shopperFromRequest(req);
    if (!shopper || shopper.id !== order.userId) {
      return NextResponse.json(
        { error: "Please sign in to pay for this order.", code: "auth_required" },
        { status: 401 }
      );
    }
  }

  const gatewayReady =
    (order.paymentProvider === "cashfree" && cashfreeConfigured()) ||
    (order.paymentProvider === "razorpay" && razorpayConfigured());
  if (!gatewayReady) {
    return NextResponse.json({ mode: "simulator", url: `/pay/simulator?order=${order.id}` });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ mode: "paid", url: `/order/${order.id}` });
  }

  try {
    const session = await reopenPayment(order);
    if (session) return NextResponse.json(session);
    return NextResponse.json(
      { error: "This payment link has expired — please check out again.", code: "expired" },
      { status: 410 }
    );
  } catch (err) {
    console.error("[pay/retry]", order.id, err);
    return NextResponse.json({ error: "Couldn't reach the payment service. Please try again." }, { status: 502 });
  }
}
