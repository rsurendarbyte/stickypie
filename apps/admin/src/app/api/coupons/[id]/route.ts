import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };
const body = z
  .object({
    percent: z.number().int().min(1, "Offer is at least 1%").max(50, "Offer is at most 50%").optional(),
    disabled: z.boolean().optional(),
  })
  .refine((b) => b.percent !== undefined || b.disabled !== undefined, "Nothing to change");

/** Edit an offer any time before it's used: change its %, switch it off or on. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  try {
    await auth.driver.updateCoupon(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}
