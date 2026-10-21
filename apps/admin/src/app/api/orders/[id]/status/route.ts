import { NextResponse } from "next/server";
import { fulfillmentStatusSchema, shipmentSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: { status?: string; shipment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = fulfillmentStatusSchema.safeParse(body.status);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Shipping always records the courier + tracking number for the customer.
  let shipment;
  if (parsed.data === "shipped") {
    const details = shipmentSchema.safeParse(body.shipment ?? {});
    if (!details.success) {
      return NextResponse.json(
        { error: details.error.issues[0]?.message ?? "Enter the shipping details" },
        { status: 400 }
      );
    }
    shipment = details.data;
  }

  try {
    const order = await auth.driver.updateOrderStatus(id, parsed.data, shipment);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update order" },
      { status: 400 }
    );
  }
}
