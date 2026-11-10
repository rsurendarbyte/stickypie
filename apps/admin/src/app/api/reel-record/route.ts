import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/data";
import { JOURNEYS, recordJourney, recorderReady, type JourneyId } from "@/lib/reel/record";

export const runtime = "nodejs";
export const maxDuration = 300;

const SITES: Record<string, string> = { dev: "https://dev.stickypie.in", live: "https://stickypie.in" };

const Body = z.object({
  journey: z.enum(JOURNEYS.map((j) => j.id) as [JourneyId, ...JourneyId[]]),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  site: z.enum(["dev", "live"]),
  hookPng: z.string().max(4_000_000).nullable().optional(),
  ctaPng: z.string().max(4_000_000).nullable().optional(),
});

const png = (dataUrl?: string | null) => (dataUrl?.startsWith("data:image/png;base64,") ? Buffer.from(dataUrl.slice(22), "base64") : null);

/** GET: can this admin record? (only the one running on the Mac) */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const problem = await recorderReady();
  return NextResponse.json({ ok: !problem, problem });
}

/** POST: records one shopper journey and returns the MP4. */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const problem = await recorderReady();
  if (problem) return NextResponse.json({ error: problem }, { status: 501 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { journey, slug, site, hookPng, ctaPng } = parsed.data;
  try {
    const mp4 = await recordJourney({ journey, slug, site: SITES[site], hookPng: png(hookPng), ctaPng: png(ctaPng) });
    return new Response(new Uint8Array(mp4), { headers: { "Content-Type": "video/mp4", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Recording failed" }, { status: 500 });
  }
}
