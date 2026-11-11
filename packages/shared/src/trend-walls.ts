// The daily trend-walls run (a Claude scheduled task on the Mac): the
// instructions it follows, edited in admin → Approve, and what its last run made.
// Kept inside store_settings.features as `trendWalls`, like the home page.
// Browser-safe.
import { z } from "zod";

export type TrendWallsRun = {
  /** ISO time the run saved its walls. */
  at: string;
  /** Walls saved as drafts. */
  made: string[];
  /** Walls that failed, with why. */
  skipped: string[];
};

export type TrendWalls = {
  /** What to make and what to avoid: the run reads this every morning. */
  prompt: string;
  lastRun: TrendWallsRun | null;
};

export const DEFAULT_TREND_WALLS_PROMPT = `Make 3 to 5 new walls a day from what India is searching today, using only posters already in the shop.

- Stop and make nothing if 12 or more walls are already waiting for approval.
- Translate searches in Indian languages first.
- Skip real people, deaths, war, politics and news tragedies.
- Turn a trend into a theme our posters already cover: a cricket match → cricket and sport posters, an Air Force day → jets and aviation, a holiday → travel. Skip a trend unless at least 6 posters clearly belong.
- Wall names: 2–3 catchy words, new, no person or brand names.
- Look at every finished wall picture and say if one looks wrong.`;

export const DEFAULT_TREND_WALLS: TrendWalls = { prompt: DEFAULT_TREND_WALLS_PROMPT, lastRun: null };

export const trendWallsPromptSchema = z.object({ prompt: z.string().trim().min(20).max(4000) });

const runSchema = z.object({ at: z.string(), made: z.array(z.string()), skipped: z.array(z.string()) });

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToTrendWalls(value: any): TrendWalls {
  const prompt = trendWallsPromptSchema.safeParse({ prompt: value?.prompt });
  const run = runSchema.safeParse(value?.lastRun);
  return { prompt: prompt.success ? prompt.data.prompt : DEFAULT_TREND_WALLS_PROMPT, lastRun: run.success ? run.data : null };
}
