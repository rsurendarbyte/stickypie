// What it costs to make a wall set, entered in admin → Wall costs. Kept inside
// store_settings.features as `wallCosts`, like the home page; anything missing
// falls back to the defaults here. All money in ₹. Browser-safe.
import { z } from "zod";

/** What one sheet of a paper costs: the blank sheet, and printing it. */
export type SheetRate = { sheet: number; print: number };

export type WallCosts = {
  /** Paper id from PAPERS. */
  paper: string;
  /** Rates by paper id; a paper not entered yet is worked out from A4 by its area. */
  rates: Record<string, SheetRate>;
  /** Spoiled sheets, as % added to paper and printing. */
  wastage: number;
  /** Cutting one sheet. */
  cutPerSheet: number;
  /** Glue dots or tape for one poster. */
  gluePerPoster: number;
  /** Box, cover and label for one set. */
  packingPerSet: number;
  /** Cricut margins in inches, the same as on the print sheets. */
  area: { left: number; right: number; top: number; bottom: number };
};

const A4_AREA = 210 * 297;

export const DEFAULT_WALL_COSTS: WallCosts = {
  paper: "a4",
  rates: { a4: { sheet: 17, print: 10 } },
  wastage: 10,
  cutPerSheet: 0,
  gluePerPoster: 2,
  packingPerSet: 0,
  area: { left: 0.5, right: 0.5, top: 1.125, bottom: 0.5 },
};

const amount = z.number().min(0).max(100000);

export const wallCostsSchema = z.object({
  paper: z.string().min(1),
  rates: z.record(z.string(), z.object({ sheet: amount, print: amount })),
  wastage: z.number().min(0).max(100),
  cutPerSheet: amount,
  gluePerPoster: amount,
  packingPerSet: amount,
  area: z.object({ left: amount, right: amount, top: amount, bottom: amount }),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToWallCosts(value: any): WallCosts {
  const merged = {
    ...DEFAULT_WALL_COSTS,
    ...(value && typeof value === "object" ? value : {}),
    area: { ...DEFAULT_WALL_COSTS.area, ...value?.area },
  };
  const parsed = wallCostsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_WALL_COSTS;
}

/** The paper's rate as entered, or A4's scaled to its area, rounded to 50 paise. */
export function sheetRate(costs: WallCosts, paper: { id: string; w: number; h: number }): SheetRate {
  const saved = costs.rates[paper.id];
  if (saved) return saved;
  const base = costs.rates.a4 ?? DEFAULT_WALL_COSTS.rates.a4;
  const scale = (paper.w * paper.h) / A4_AREA;
  const round = (n: number) => Math.round(n * scale * 2) / 2;
  return { sheet: round(base.sheet), print: round(base.print) };
}

/** One sheet ready to cut up: paper and printing with wastage, then cutting. */
export function costPerSheet(costs: WallCosts, rate: SheetRate): number {
  return (rate.sheet + rate.print) * (1 + costs.wastage / 100) + costs.cutPerSheet;
}

/** Making one set: whole sheets, because a sheet is bought whole even if the last one isn't full. */
export function wallCost(costs: WallCosts, rate: SheetRate, sheets: number, posters: number): number {
  return sheets * costPerSheet(costs, rate) + posters * costs.gluePerPoster + costs.packingPerSet;
}
