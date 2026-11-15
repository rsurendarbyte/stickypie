// Contact conversations: the storefront holds the email and service keys, so
// after a reply or status change the admin asks it (with the admin's own
// access token) to signal the shopper's open pages live and, for a reply,
// email it. Never fatal: returns whether an email went out.
import { supabaseConfigured, webUrl } from "./auth";
import { createServerSupabase } from "./supabase";

export async function notifyStorefront(messageId: string, email: boolean): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const supabase = await createServerSupabase();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(`${webUrl()}/api/contact/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, email }),
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json().catch(() => ({}))) as { emailed?: boolean };
    return res.ok && data.emailed === true;
  } catch (err) {
    console.error("[messages] storefront notify failed:", err);
    return false;
  }
}
