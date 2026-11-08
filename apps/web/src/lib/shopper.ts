// Server-only: identify the signed-in shopper behind an API request.
// The browser sends its Supabase access token as `Authorization: Bearer …`;
// Supabase Auth confirms it and tells us who it belongs to.
import { holdsGuestOrder } from "./guest-order";
import { supabaseConfigured, supabaseUrl } from "./mode";

export type Shopper = { id: string; email: string };

/** Accounts need Supabase; demo mode (local JSON store) stays guest-only. */
export function accountsEnabled(): boolean {
  return supabaseConfigured();
}

/**
 * Cookie copy of the shopper's access token, kept in step with the browser
 * session by <AuthCookieSync>, so server-rendered pages (order, invoice) know
 * who is looking.
 */
export const SHOPPER_COOKIE = "sp_at";

export async function shopperFromRequest(req: Request): Promise<Shopper | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return shopperFromToken(token);
}

/** Server components: the shopper whose token is in the cookie (null if none / expired). */
export async function shopperFromCookies(): Promise<Shopper | null> {
  const { cookies } = await import("next/headers");
  return shopperFromToken((await cookies()).get(SHOPPER_COOKIE)?.value ?? "");
}

async function shopperFromToken(token: string): Promise<Shopper | null> {
  if (!token) return null;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => null)) as { id?: string; email?: string } | null;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email.toLowerCase() };
}

/**
 * Admin preview of an order page: holds the admin's access token, set by
 * /api/admin-view when the admin clicks "View as customer". httpOnly, 1 hour.
 */
export const ADMIN_VIEW_COOKIE = "sp_av";

/** True when the token belongs to an account in admin_users. */
export async function isAdminToken(token: string): Promise<boolean> {
  const user = await shopperFromToken(token);
  if (!user) return false;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
  );
  if (!res.ok) return false;
  const rows = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Who is looking at an order: the signed-in shopper who placed it, or the
 * browser / link holding a guest order's key ("owner"), an admin previewing
 * it ("admin"), or nobody allowed (null).
 * Demo mode (no accounts) keeps orders open.
 */
export async function orderViewer(
  order: { id: string; userId: string | null },
  linkKey?: string
): Promise<"owner" | "admin" | null> {
  if (!accountsEnabled()) return "owner";
  const shopper = await shopperFromCookies();
  if (shopper && order.userId && shopper.id === order.userId) return "owner";
  if (await holdsGuestOrder(order, linkKey)) return "owner";
  const { cookies } = await import("next/headers");
  const adminToken = (await cookies()).get(ADMIN_VIEW_COOKIE)?.value ?? "";
  if (adminToken && (await isAdminToken(adminToken))) return "admin";
  return null;
}

/** Who may see an order's details: its shopper, or an admin previewing it. */
export async function canViewOrder(order: { id: string; userId: string | null }, linkKey?: string): Promise<boolean> {
  return (await orderViewer(order, linkKey)) !== null;
}
