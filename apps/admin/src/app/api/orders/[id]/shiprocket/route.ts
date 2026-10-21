import { NextResponse } from "next/server";
import { z } from "zod";
import { advanceOrderTo, shiprocketTrackingUrl } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";
import {
  assignAwb,
  cheapestCourier,
  createShiprocketOrder,
  schedulePickup,
  shippingLabel,
  shiprocketConfig,
} from "@/lib/shiprocket";

const parcelSchema = z.object({
  weightKg: z.number().min(0.05, "Weight must be at least 0.05 kg").max(20),
  lengthCm: z.number().min(1).max(150),
  breadthCm: z.number().min(1).max(150),
  heightCm: z.number().min(0.5).max(150),
});

/**
 * "Package is ready": marks the order packed (if it was paid), creates the
 * Shiprocket order, books the courier (AWB), schedules pickup and fetches the
 * label. Each step is saved as it succeeds, so pressing it again resumes.
 * The order moves to "shipped"/"delivered" later from Shiprocket's webhook.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const cfg = shiprocketConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Shiprocket isn't set up — add SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_LOCATION to the admin env file." },
      { status: 400 }
    );
  }
  const { id } = await ctx.params;
  const parsed = parcelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the parcel size" }, { status: 400 });
  }

  const driver = auth.driver;
  let order = await driver.getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const warnings: string[] = [];
  let shipping: { courier: string; rate: number; days: number | null } | null = null;

  try {
    if (order.status === "paid") order = await advanceOrderTo(driver, order, "packed");
    if (order.status !== "packed") {
      return NextResponse.json({ error: `A "${order.status}" order can't be shipped through Shiprocket.` }, { status: 409 });
    }
    const settings = await driver.getSettings();

    let shipmentId = order.shiprocketShipmentId;
    let shiprocketOrderId = order.shiprocketOrderId;
    if (!shipmentId) {
      const created = await createShiprocketOrder(cfg, order, parsed.data, settings.business.hsn);
      shipmentId = created.shipmentId;
      shiprocketOrderId = created.orderId;
      await driver.setShipmentRefs(id, { shiprocketOrderId: created.orderId, shiprocketShipmentId: created.shipmentId });
    }

    if (!order.trackingNumber) {
      // Cheapest courier that delivers within a week; Shiprocket's pick if quotes fail.
      let pick: Awaited<ReturnType<typeof cheapestCourier>> = null;
      if (shiprocketOrderId) {
        try {
          pick = await cheapestCourier(cfg, shiprocketOrderId);
        } catch (err) {
          warnings.push(`Couldn't compare couriers (${err instanceof Error ? err.message : err}) — used Shiprocket's pick.`);
        }
      }
      const { awb, courier } = await assignAwb(cfg, shipmentId, pick?.id);
      if (pick) shipping = { courier: pick.name, rate: pick.rate, days: pick.days };
      await driver.setShipmentRefs(id, { courier, trackingNumber: awb, trackingUrl: shiprocketTrackingUrl(awb) });
    }

    try {
      await schedulePickup(cfg, shipmentId);
    } catch (err) {
      warnings.push(`Pickup not scheduled: ${err instanceof Error ? err.message : err} — schedule it in Shiprocket.`);
    }
    if (!order.labelUrl) {
      try {
        const label = await shippingLabel(cfg, shipmentId);
        if (label) await driver.setShipmentRefs(id, { labelUrl: label });
      } catch (err) {
        warnings.push(`Label not ready: ${err instanceof Error ? err.message : err} — download it from Shiprocket.`);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Shiprocket request failed" }, { status: 502 });
  }

  return NextResponse.json({ order: await driver.getOrder(id), warnings, shipping });
}
