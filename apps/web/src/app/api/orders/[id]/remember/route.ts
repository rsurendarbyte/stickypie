import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDriver } from "@/lib/data";
import { GUEST_ORDERS_COOKIE, guestCookieOptions, holdsGuestOrder, withGuestOrder } from "@/lib/guest-order";

const bodySchema = z.object({ k: z.string().max(64) });

/**
 * A guest order opened from its link (?k=…): the address bar drops the key
 * (so ad pixels never see it), and this keeps it in the browser's guest-order
 * cookie instead, so a reload or a later visit still opens the order.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const order = await getDriver().getOrder(id);
  if (!order || !(await holdsGuestOrder(order, parsed.data.k))) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const res = NextResponse.json({ ok: true });
  const current = (await cookies()).get(GUEST_ORDERS_COOKIE)?.value;
  res.cookies.set(GUEST_ORDERS_COOKIE, withGuestOrder(current, order.id), guestCookieOptions);
  return res;
}
