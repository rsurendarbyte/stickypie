import path from "node:path";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DataDriver } from "@stickypie/shared";
import { createLocalDriver } from "@stickypie/shared/local";
import { createSupabaseDriver } from "@stickypie/shared/supabase";
import { ADMIN_COOKIE, demoToken, supabaseConfigured } from "./auth";
import { isAdminUser } from "./admin-check";
import { createServerSupabase } from "./supabase";

function localDriver(): DataDriver {
  return createLocalDriver(
    process.env.DATA_FILE ?? path.resolve(process.cwd(), "../../data/dev-store.json")
  );
}

/**
 * Data access for a signed-in admin.
 * - Demo mode → shared local JSON store (same file as the storefront).
 * - Supabase → the admin's own session client; RLS enforces admin-only writes.
 */
export async function getAdminDriver(): Promise<DataDriver> {
  if (!supabaseConfigured()) return localDriver();
  return createSupabaseDriver(await createServerSupabase());
}

/**
 * The signed-in admin's email, or null. Once per request however many places
 * ask (layout, page, API guard). getClaims checks the login's signature here
 * with the project's cached public key, so only the admin_users lookup goes
 * over the network.
 */
const currentAdmin = cache(async (): Promise<{ email: string } | null> => {
  if (!supabaseConfigured()) {
    const store = await cookies();
    return store.get(ADMIN_COOKIE)?.value === (await demoToken()) ? { email: "Local admin" } : null;
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims.sub;
  if (!id) return null;
  const { admin } = await isAdminUser(supabase, id);
  return admin ? { email: String(auth.claims.email ?? "Admin") } : null;
});

/** True when the current request belongs to a signed-in admin. */
export async function isAuthedAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

export async function sessionLabel(): Promise<string> {
  return (await currentAdmin())?.email ?? "Admin";
}

type AdminAuth = { ok: true; driver: DataDriver } | { ok: false; res: NextResponse };

/** Guard for API route handlers. */
export async function requireAdminApi(): Promise<AdminAuth> {
  if (!(await isAuthedAdmin())) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, driver: await getAdminDriver() };
}
