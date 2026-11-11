import { NextResponse } from "next/server";
import { trendWallsPromptSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the daily trend-walls run's instructions (admin → Approve). */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = trendWallsPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid prompt" }, { status: 400 });
  }
  try {
    return NextResponse.json({ trendWalls: await auth.driver.updateTrendWallsPrompt(parsed.data.prompt) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the prompt" }, { status: 400 });
  }
}
