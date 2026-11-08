import type { SupabaseClient } from "@supabase/supabase-js";

// Whether an account is in admin_users, remembered for a minute in this server
// process: the proxy and the page both ask on every click, and the answer
// almost never changes. Only a "yes" is remembered, so a removed admin is out
// within a minute and a failed lookup is simply asked again.
const KEEP_MS = 60_000;
const confirmed = new Map<string, number>();

export async function isAdminUser(supabase: SupabaseClient, userId: string): Promise<{ admin: boolean; failed: boolean }> {
  const at = confirmed.get(userId);
  if (at && Date.now() - at < KEEP_MS) return { admin: true, failed: false };
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (data) confirmed.set(userId, Date.now());
  else confirmed.delete(userId);
  return { admin: Boolean(data), failed: Boolean(error) };
}
