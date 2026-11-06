import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/data";
import { saveWallPosters } from "@/lib/wall-reshuffle";

const bodySchema = z.object({
  packItems: z.array(z.string().min(1)).min(1).max(60),
  packSizes: z.array(z.union([z.literal(6), z.literal(9)])).min(1).max(60),
});

/** Saves a wall's posters, spot for spot. Refused while an order for the wall is open. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid posters" }, { status: 400 });
  try {
    const wall = await auth.driver.getProductById(id);
    if (!wall?.packItems.length) return NextResponse.json({ error: "Wall not found" }, { status: 404 });
    const product = await saveWallPosters(auth.driver, wall, parsed.data.packItems, parsed.data.packSizes);
    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the wall" }, { status: 400 });
  }
}
