import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { DataDriver } from "@stickypie/shared";
import { createLocalDriver } from "@stickypie/shared/local";
import { createSupabaseDriver } from "@stickypie/shared/supabase";
import { supabaseConfigured, supabaseUrl } from "./mode";

let driver: DataDriver | null = null;

/**
 * Storefront data access (server only).
 * - Supabase configured → service-role client (order writes bypass RLS; the
 *   key never reaches the browser).
 * - Otherwise → file-backed demo store shared with the admin app.
 */
export function getDriver(): DataDriver {
  if (driver) return driver;
  if (supabaseConfigured()) {
    const client = createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    driver = createSupabaseDriver(client);
  } else {
    driver = createLocalDriver(
      process.env.DATA_FILE ?? path.resolve(process.cwd(), "../../data/dev-store.json")
    );
  }
  return driver;
}
