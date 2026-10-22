import { NextResponse } from "next/server";
import { getDriver } from "@/lib/data";
import { razorpayConfigured } from "@/lib/mode";
import { reconcileOrderPayment } from "@/lib/payments";
import { verifyRzpWebhook } from "@/lib/razorpay";

/**
 * Razorpay webhooks (payment.captured, payment.authorized, order.paid…). The
 * event only says WHICH order to look at — its status is re-read from
 * Razorpay's API, so duplicates, out-of-order or replayed events are harmless.
 * Set in Razorpay → Settings → Webhooks with RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!razorpayConfigured()) return NextResponse.json({ ok: true });

  if (!verifyRzpWebhook(raw, req.headers.get("x-razorpay-signature") ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  type Entity = { notes?: { order_id?: string }; receipt?: string };
  let event: { event?: string; payload?: { payment?: { entity?: Entity }; order?: { entity?: Entity } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orderId =
    event.payload?.payment?.entity?.notes?.order_id ??
    event.payload?.order?.entity?.notes?.order_id ??
    event.payload?.order?.entity?.receipt;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ ok: true, ignored: "no order" });

  // The Razorpay account may serve other apps too — ignore orders that aren't ours.
  const order = await getDriver().getOrder(orderId).catch(() => null);
  if (!order || order.paymentProvider !== "razorpay") {
    return NextResponse.json({ ok: true, ignored: "order not in this store" });
  }

  try {
    const after = await reconcileOrderPayment(order);
    return NextResponse.json({ ok: true, status: after.status });
  } catch (err) {
    console.error("[webhook/razorpay] could not reconcile", orderId, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Razorpay retries
  }
}
