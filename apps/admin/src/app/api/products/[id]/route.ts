import { NextResponse } from "next/server";
import { isWallDataTag, productInputSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";
import { prepareProductInput } from "@/lib/product-input";
import { onWallsMessage, wallName } from "@/lib/wall-names";
import { redrawPosterOnWalls, wallsHolding } from "@/lib/wall-reshuffle";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = productInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  try {
    const existing = parsed.data.imageUrl || parsed.data.tags ? await auth.driver.getProductById(id) : null;
    // The form never sees a wall's data tags; they stay as they are.
    const tags = parsed.data.tags && [...parsed.data.tags, ...(existing?.tags.filter(isWallDataTag) ?? [])];
    const product = await auth.driver.updateProduct(id, await prepareProductInput({ ...parsed.data, ...(tags && { tags }) }, existing));
    const newImage = parsed.data.imageUrl && existing && parsed.data.imageUrl !== existing.imageUrl;
    const walls = newImage ? await redrawPosterOnWalls(auth.driver, product) : undefined;
    return NextResponse.json({ product, walls });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update product" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const walls = wallsHolding(await auth.driver.listProducts(), id).map((w) => wallName(w.name));
    if (walls.length) return NextResponse.json({ error: onWallsMessage(walls) }, { status: 409 });
    await auth.driver.deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete product" },
      { status: 400 }
    );
  }
}
