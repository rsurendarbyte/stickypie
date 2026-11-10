import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDriver } from "@/lib/data";
import { GUEST_ORDERS_COOKIE, guestCookieOptions, holdsGuestOrder, withGuestOrder } from "@/lib/guest-order";

const bodySchema = z.object({ k: z.string().max(64) });

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // "null" (sandboxed frame, file:) is never this shop
  }
}

/**
 * A guest order opened from its link (?k=…): the address bar drops the key
 * (so ad pixels never see it), and this keeps it in the browser's guest-order
 * cookie instead, so a reload or a later visit still opens the order.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Only this shop's own pages may call it: a form on another site (no JSON
  // content type, a foreign Origin) could otherwise fill a shopper's cookie
  // with someone else's orders.
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (
    !req.headers.get("content-type")?.startsWith("application/json") ||
    (origin && !sameHost(origin, req.headers.get("host") ?? new URL(req.url).host)) ||
    (site && site !== "same-origin")
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  }
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
