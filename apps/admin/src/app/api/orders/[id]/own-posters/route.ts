import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/data";

/** Deletes the pictures of an order's own posters now, before their days are up. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    await auth.driver.clearOwnPosters(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete the pictures" }, { status: 400 });
  }
}
