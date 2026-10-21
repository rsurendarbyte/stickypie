// Moving an order forward through fulfilment, and reading courier statuses.
import type { DataDriver, Order, ShipmentInfo } from "./types";

const FLOW = ["paid", "packed", "shipped", "delivered"] as const;
type FlowStatus = (typeof FLOW)[number];

/**
 * Steps an order forward (paid → packed → shipped → delivered) until it reaches
 * `target`, one allowed transition at a time. Never moves backwards; orders
 * outside the flow (pending, cancelled…) are left alone.
 */
export async function advanceOrderTo(
  driver: DataDriver,
  order: Order,
  target: Exclude<FlowStatus, "paid">,
  shipment?: ShipmentInfo
): Promise<Order> {
  let current = order;
  let at = FLOW.indexOf(current.status as FlowStatus);
  const goal = FLOW.indexOf(target);
  if (at < 0) return current;
  while (at < goal) {
    const next = FLOW[at + 1] as Exclude<FlowStatus, "paid">;
    const details =
      next === "shipped"
        ? (shipment ?? (current.courier && current.trackingNumber
            ? { courier: current.courier, trackingNumber: current.trackingNumber, trackingUrl: current.trackingUrl }
            : undefined))
        : undefined;
    if (next === "shipped" && !details) throw new Error("Courier and tracking number are needed to mark it shipped");
    current = await driver.updateOrderStatus(current.id, next, details);
    at += 1;
  }
  return current;
}

/**
 * Maps a Shiprocket / courier status ("IN TRANSIT", "Delivered", "RTO
 * INITIATED"…) to what it means for the order. null = no change (e.g. pickup
 * still pending, or a return/cancellation that needs a human).
 */
export function courierStatusToOrderStatus(status: string): "shipped" | "delivered" | null {
  const s = status.trim().toUpperCase();
  if (!s || s.startsWith("RTO") || /CANCEL|LOST|DAMAGE|DESTROY|UNDELIVERED|DISPOSED/.test(s)) return null;
  if (s === "DELIVERED") return "delivered";
  if (/PICKED UP|SHIPPED|IN TRANSIT|OUT FOR DELIVERY|REACHED|DESTINATION|MISROUTED|DELAYED|IN-TRANSIT/.test(s)) {
    return "shipped";
  }
  return null;
}

/** Public tracking page for a Shiprocket AWB. */
export const shiprocketTrackingUrl = (awb: string) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
