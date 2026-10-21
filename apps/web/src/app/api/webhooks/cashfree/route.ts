import { NextResponse } from "next/server";
import { verifyCfWebhook } from "@/lib/cashfree";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured } from "@/lib/mode";

/**
 * Cashfree payment webhooks (configure in the Cashfree dashboard:
 * <site>/api/webhooks/cashfree, version 2023-08-01). The return-url flow
 * already confirms orders; this keeps the DB correct even when the buyer
 * never returns to the site.
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

  let event: {
    type?: string;
    data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: string | number } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = event.type ?? "";
  const orderId = event.data?.order?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });

  const driver = getDriver();

  // The Cashfree account may also serve other applications, and account-level
  // webhooks fan out every event to every endpoint. Acknowledge events for
  // orders that aren't ours (foreign or malformed ids) so Cashfree stops
  // retrying them; only this store's orders are processed below.
  let order = null;
  try {
    order = await driver.getOrder(orderId);
  } catch {
    order = null;
  }
  if (!order) {
    return NextResponse.json({ ok: true, ignored: "order not in this store" });
  }
  // Settled orders stay settled — a duplicate or late event (e.g. FAILED after
  // the return-url flow already confirmed) must not change them.
  if (order.status !== "pending") {
    return NextResponse.json({ ok: true, ignored: `order already ${order.status}` });
  }

  try {
    if (type.includes("PAYMENT_SUCCESS")) {
      const paymentId = event.data?.payment?.cf_payment_id;
      await driver.markOrderPaid(orderId, {
        paymentId: paymentId !== undefined ? String(paymentId) : null,
        note: "Confirmed via Cashfree webhook",
      });
    } else if (type.includes("PAYMENT_FAILED") || type.includes("USER_DROPPED")) {
      await driver.markOrderFailed(orderId, `Cashfree webhook: ${type}`);
    }
  } catch (err) {
    console.error("[webhook] failed to process Cashfree event:", err);
    // Non-200 → Cashfree retries later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
