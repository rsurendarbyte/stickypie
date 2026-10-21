import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ status: z.enum(["pending", "approved", "rejected"]) });

/** Approve / reject a review (approved ones show on the sticker page). */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  try {
    await auth.driver.setReviewStatus(id, parsed.data.status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    await auth.driver.deleteReview(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 400 });
  }
}
