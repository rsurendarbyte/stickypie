import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/data";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const order = await auth.driver.cancelOrder(id);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not cancel order" },
      { status: 400 }
    );
  }
}
