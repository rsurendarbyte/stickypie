import { NextResponse } from "next/server";
import { z } from "zod";
import { REWARD_VALID_DAYS, makeCouponCode } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

const body = z.object({
  orderId: z.string().uuid(),
  /** null = "no offer" for this feedback (recorded so it leaves the waiting list). */
  percent: z.number().int().min(1).max(50).nullable(),
});

/**
 * After reading a customer's feedback: give them a next-order offer (shown on
 * their account, taken off at their next checkout, once) or record no offer.
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Offer is 1–50%" }, { status: 400 });
  const { orderId, percent } = parsed.data;
  const driver = auth.driver;
  const order = await driver.getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (await driver.getCouponForOrder(orderId)) {
    return NextResponse.json({ error: "This feedback already has a decision." }, { status: 409 });
  }
  try {
    const coupon = await driver.createCoupon({
      code: makeCouponCode(),
      percent: percent ?? 0,
      sourceOrderId: orderId,
      email: order.email,
      phone: order.phone,
      expiresAt: new Date(Date.now() + REWARD_VALID_DAYS * 86_400_000).toISOString(),
      disabled: percent === null,
    });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}
