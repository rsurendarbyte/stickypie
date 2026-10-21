import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/auth";
import { requireAdminApi } from "@/lib/data";

/** Re-seeds the local demo store. Demo mode only. */
export async function POST() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  if (supabaseConfigured() || !auth.driver.resetDemoData) {
    return NextResponse.json({ error: "Only available in demo mode" }, { status: 400 });
  }
  await auth.driver.resetDemoData();
  return NextResponse.json({ ok: true });
}
