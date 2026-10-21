import { NextResponse } from "next/server";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured } from "@/lib/mode";

/**
 * Local-dev payment simulator. Only active while Cashfree keys are NOT
 * configured; orders created for the real gateway can never be confirmed here.
 */
export async function POST(req: Request) {
  if (cashfreeConfigured()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  let body: { orderId?: string; outcome?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { orderId, outcome } = body;
  if (!orderId || (outcome !== "success" && outcome !== "failure")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const driver = getDriver();
  const order = await driver.getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentProvider !== "simulator") {
    return NextResponse.json({ error: "Not a simulator order" }, { status: 400 });
  }

  if (outcome === "success") {
    await driver.markOrderPaid(orderId, {
      paymentId: `sim_${Date.now()}`,
      note: "Simulated payment (local dev)",
    });
  } else {
    await driver.markOrderFailed(orderId, "Simulated failure (local dev)");
  }
  return NextResponse.json({ ok: true });
}
