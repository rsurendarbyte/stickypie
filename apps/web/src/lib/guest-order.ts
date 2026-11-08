// Server-only: orders placed without an account. Each guest order has a key
// worked out from its id (nothing stored), kept in an httpOnly cookie on the
// browser that placed it and in the order link (?k=…) it can be opened from
// anywhere else. Orders placed from an account never open with a key.
import { createHmac } from "node:crypto";
import { sameToken } from "@stickypie/shared";

/** The browser's guest orders, newest first: "orderId.key|orderId.key". */
export const GUEST_ORDERS_COOKIE = "sp_go";
const KEEP = 10;

export function guestOrderKey(orderId: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(`guest-order:${orderId}`)
    .digest("hex")
    .slice(0, 32);
}

/** The cookie value with this order added at the front. */
export function withGuestOrder(current: string | undefined, orderId: string): string {
  const others = (current ?? "").split("|").filter((e) => e && !e.startsWith(`${orderId}.`));
  return [`${orderId}.${guestOrderKey(orderId)}`, ...others].slice(0, KEEP).join("|");
}

export const guestCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

/** True when this guest order's key came with the link or sits in this browser's cookie. */
export async function holdsGuestOrder(order: { id: string; userId: string | null }, linkKey?: string): Promise<boolean> {
  if (order.userId) return false;
  const want = guestOrderKey(order.id);
  if (sameToken(linkKey, want)) return true;
  const { cookies } = await import("next/headers");
  const saved = (await cookies()).get(GUEST_ORDERS_COOKIE)?.value ?? "";
  return saved.split("|").some((e) => sameToken(e, `${order.id}.${want}`));
}
