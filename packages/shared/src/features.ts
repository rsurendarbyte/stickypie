// Storefront feature switches, toggled from admin → Features. Stored as one
// JSON object on store_settings; anything missing falls back to its default,
// so adding a feature here needs no migration. Browser-safe.
import { z } from "zod";

export const FEATURES = {
  avatarStickers: {
    label: "Avatar sticker packs",
    description: "Shoppers send a photo, pick a style for each pack and buy the sticker packs (set up in Avatar packs); we make the packs with AI and show them on the order page. Leads the home banner.",
    default: true,
  },
  customStickers: {
    label: "Custom stickers",
    description: "Shoppers pick a size and quantity, pay (prices per size in Settings), then upload their artwork from the order page.",
    default: true,
  },
  sizeRuler: {
    label: "Size ruler on sticker pages",
    description: "Width and height arrows (in inches) around the sticker art, following the size the shopper picks.",
    default: true,
  },
  wallPostersOnly: {
    label: "Home banner wall: mini posters only",
    description: "The moving wall on the first home banner slide shows only mini posters. Off: it shows stickers and posters mixed.",
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
