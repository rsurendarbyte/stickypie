import { NextResponse } from "next/server";
import { wallCostsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves what's entered on the Wall costs page. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = wallCostsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid costs" }, { status: 400 });
  }
  try {
    const costs = await auth.driver.updateWallCosts(parsed.data);
    return NextResponse.json({ costs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the costs" },
      { status: 400 }
    );
  }
}
