// Server-only: identify the signed-in shopper behind an API request.
// The browser sends its Supabase access token as `Authorization: Bearer …`;
// Supabase Auth confirms it and tells us who it belongs to.
import { supabaseConfigured, supabaseUrl } from "./mode";

export type Shopper = { id: string; email: string };

/** Accounts need Supabase; demo mode (local JSON store) stays guest-only. */
export function accountsEnabled(): boolean {
  return supabaseConfigured();
}

export async function shopperFromRequest(req: Request): Promise<Shopper | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
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
