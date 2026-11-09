import { NextResponse } from "next/server";
import { PUZZLE_PERCENT_MAX } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the poster puzzle prize's percent off. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => null)) as { percent?: unknown } | null;
  const percent = Number(body?.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > PUZZLE_PERCENT_MAX) {
    return NextResponse.json({ error: `Pick a whole number from 1 to ${PUZZLE_PERCENT_MAX}` }, { status: 400 });
  }
  try {
    return NextResponse.json({ percent: await auth.driver.updatePuzzlePercent(percent) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}
