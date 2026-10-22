import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriver } from "@/lib/data";
import { reconcileOrderPayment } from "@/lib/payments";
import { verifyRzpPaymentSignature } from "@/lib/razorpay";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Razorpay's checkout success callback. The signature proves the browser got
 * the result from Razorpay, but the order is only marked paid after reading
 * the payment back from Razorpay's API (amount checked) — same as webhooks.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const order = await getDriver().getOrder(orderId);
  if (!order || order.paymentProvider !== "razorpay" || order.cfOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!verifyRzpPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Payment could not be verified" }, { status: 400 });
  }
  try {
    const after = await reconcileOrderPayment(order);
    return NextResponse.json({ ok: true, status: after.status, url: `/order/${order.id}` });
  } catch (err) {
    console.error("[razorpay/verify]", orderId, err);
    // The webhook / order page will settle it.
    return NextResponse.json({ ok: true, status: order.status, url: `/order/${order.id}` });
  }
}
