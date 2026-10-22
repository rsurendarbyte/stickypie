// Storefront feature switches, toggled from admin → Features. Stored as one
// JSON object on store_settings; anything missing falls back to its default,
// so adding a feature here needs no migration. Browser-safe.
import { z } from "zod";

export const FEATURES = {
  sizeRuler: {
    label: "Size ruler on sticker pages",
    description: "Width and height arrows (in inches) around the sticker art, following the size the shopper picks.",
    default: true,
  },
} as const satisfies Record<string, { label: string; description: string; default: boolean }>;

export type FeatureKey = keyof typeof FEATURES;
export type FeatureFlags = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES = Object.fromEntries(
  Object.entries(FEATURES).map(([key, f]) => [key, f.default])
) as FeatureFlags;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToFeatures(value: any): FeatureFlags {
  const flags = { ...DEFAULT_FEATURES };
  if (value && typeof value === "object") {
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      if (typeof value[key] === "boolean") flags[key] = value[key];
    }
  }
  return flags;
}

export const featureFlagsSchema = z.object(
  Object.fromEntries(Object.keys(FEATURES).map((key) => [key, z.boolean()])) as Record<FeatureKey, z.ZodBoolean>
);
