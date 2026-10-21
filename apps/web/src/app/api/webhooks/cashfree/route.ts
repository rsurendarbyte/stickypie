import { NextResponse } from "next/server";
import { verifyCfWebhook } from "@/lib/cashfree";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured } from "@/lib/mode";
import { reconcileOrderPayment } from "@/lib/payments";

/**
 * Cashfree payment webhooks (sent to each order's notify_url). The event only
 * tells us WHICH order to look at — its status is re-read from Cashfree's API
 * (reconcileOrderPayment), so a failed attempt followed by a successful retry,
 * duplicate deliveries, out-of-order events or a replayed body can never leave
 * an order in the wrong state.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  if (!cashfreeConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const signature = req.headers.get("x-webhook-signature") ?? "";
  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  if (!verifyCfWebhook(raw, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { order?: { order_id?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orderId = event.data?.order?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });

  // The Cashfree account may also serve other applications, and account-level
  // webhooks fan out every event to every endpoint. Acknowledge events for
  // orders that aren't ours so Cashfree stops retrying them.
  let order = null;
  try {
    order = await getDriver().getOrder(orderId);
  } catch {
    order = null;
  }
  if (!order) {
    return NextResponse.json({ ok: true, ignored: "order not in this store" });
  }

  try {
    const after = await reconcileOrderPayment(order);
    return NextResponse.json({ ok: true, status: after.status });
  } catch (err) {
    console.error("[webhook] could not reconcile order", orderId, err);
    // Non-200 → Cashfree retries later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
