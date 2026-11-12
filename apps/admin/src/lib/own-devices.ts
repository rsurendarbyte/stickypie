// The shop owner's own IPs and browsers ("This is me" on Journeys and Carts), so
// their own test visits show as "You" and stay out of the Journeys numbers.
import { supabaseConfigured } from "./auth";
import { createServerSupabase } from "./supabase";

export type OwnDevices = { ips: string[]; visitors: string[] };

export async function listOwnDevices(): Promise<OwnDevices> {
  if (!supabaseConfigured()) return { ips: [], visitors: [] };
  const db = await createServerSupabase();
  const { data, error } = await db.from("own_devices").select("ip, visitor_id");
  if (error) return { ips: [], visitors: [] }; // table not there yet: nobody is "you"
  return {
    ips: data.flatMap((r) => (r.ip ? [r.ip as string] : [])),
    visitors: data.flatMap((r) => (r.visitor_id ? [r.visitor_id as string] : [])),
  };
}
