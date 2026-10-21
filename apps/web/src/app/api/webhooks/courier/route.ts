import { NextResponse } from "next/server";
import { advanceOrderTo, courierStatusToOrderStatus, shiprocketTrackingUrl } from "@stickypie/shared";
import { getDriver } from "@/lib/data";

/**
 * Shiprocket tracking webhook (Shiprocket → Settings → API → Webhooks).
 * The URL must not contain "shiprocket" (Shiprocket rejects such URLs), hence
 * /api/webhooks/courier. Shiprocket sends the token you set there as the
 * `x-api-key` header; it must match the SHIPROCKET_WEBHOOK_TOKEN secret.
 */
function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type CourierEvent = {
  awb?: string | number;
  order_id?: string | number;
  sr_order_id?: string | number;
  courier_name?: string;
  current_status?: string;
  shipment_status?: string;
};

export async function POST(req: Request) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN ?? "";
  if (!expected) {
    console.error("[courier] SHIPROCKET_WEBHOOK_TOKEN is not set — ignoring tracking update");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }
  if (!sameToken(req.headers.get("x-api-key") ?? "", expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = (await req.json().catch(() => null)) as CourierEvent | null;
  if (!event) return NextResponse.json({ ok: true, ignored: "empty" });

  const awb = event.awb ? String(event.awb) : null;
  const status = String(event.current_status || event.shipment_status || "").trim();
  const driver = getDriver();
  try {
    const order = await driver.findOrderForShipment({
      orderId: event.order_id ? String(event.order_id) : null,
      shiprocketOrderId: event.sr_order_id ? String(event.sr_order_id) : null,
      awb,
    });
    // Not ours (the Shiprocket account may serve other shops) → acknowledge.
    if (!order) return NextResponse.json({ ok: true, ignored: "unknown order" });

    if (status) await driver.setCourierStatus(order.id, status.toUpperCase());

    const target = courierStatusToOrderStatus(status);
    if (target) {
      const shipment =
        awb && (event.courier_name || order.courier)
          ? {
              courier: event.courier_name || order.courier || "Courier",
              trackingNumber: awb,
              trackingUrl: order.trackingUrl ?? shiprocketTrackingUrl(awb),
            }
          : undefined;
      const after = await advanceOrderTo(driver, order, target, shipment);
      return NextResponse.json({ ok: true, status: after.status });
    }
    return NextResponse.json({ ok: true, status: order.status });
  } catch (err) {
    // Log and acknowledge: Shiprocket keeps retrying failures, and a bad
    // transition (e.g. a cancelled order) won't fix itself on retry.
    console.error("[courier] could not apply tracking update", { awb, status }, err);
    return NextResponse.json({ ok: true, error: "not applied" });
  }
}
