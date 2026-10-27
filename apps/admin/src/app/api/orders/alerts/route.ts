import { NextResponse } from "next/server";
import { needsArtwork, orderCode } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

// Paid orders still waiting to be packed — what the admin's new-order alerts
// (components/order-alerts.tsx) watch. Small on purpose: polled as a backup to
// the live Realtime feed.
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const orders = await auth.driver.listOrders({ status: "paid", limit: 50 });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      code: orderCode(o.id),
      total: o.total,
      paidAt: o.paidAt ?? o.createdAt,
      customer: o.customerName,
      place: [o.city, o.state].filter(Boolean).join(", "),
      stickers: o.items.reduce((n, i) => n + i.quantity, 0),
      lines: o.items.length,
      // Custom / QR / name stickers whose design hasn't been uploaded yet.
      // (QR / name stickers are drawn from their saved details — nothing to upload.)
      designsMissing: o.items.filter((i) => needsArtwork(i) && !i.customFile).length,
      customLines: o.items.filter((i) => i.isCustom).length,
    })),
  });
}
