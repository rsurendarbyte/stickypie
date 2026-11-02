import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/data";

/** POST { off?: true } — make the order's print job link (new random key), or switch it off. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { off?: boolean };
  try {
    const order = await auth.driver.getOrder(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!body.off && order.status !== "paid") {
      return NextResponse.json({ error: "Print jobs are for paid orders that aren't packed yet" }, { status: 400 });
    }
    const token = body.off ? null : crypto.randomUUID().replace(/-/g, "");
    await auth.driver.setPrintToken(id, token);
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the print job" },
      { status: 400 }
    );
  }
}
