import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/data";

/** All contact conversations (newest first, with replies): live Messages badge + list. */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  try {
    const messages = await auth.driver.listContactMessages();
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Load failed" }, { status: 500 });
  }
}
