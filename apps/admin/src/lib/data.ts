import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DataDriver } from "@stickypie/shared";
import { createLocalDriver } from "@stickypie/shared/local";
import { createSupabaseDriver } from "@stickypie/shared/supabase";
import { ADMIN_COOKIE, demoToken, supabaseConfigured } from "./auth";
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

/** True when the current request belongs to a signed-in admin. */
export async function isAuthedAdmin(): Promise<boolean> {
  if (!supabaseConfigured()) {
    const store = await cookies();
    return store.get(ADMIN_COOKIE)?.value === (await demoToken());
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

export async function sessionLabel(): Promise<string> {
  if (!supabaseConfigured()) return "Local admin";
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "Admin";
}

type AdminAuth = { ok: true; driver: DataDriver } | { ok: false; res: NextResponse };

/** Guard for API route handlers. */
export async function requireAdminApi(): Promise<AdminAuth> {
  if (!(await isAuthedAdmin())) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, driver: await getAdminDriver() };
}
