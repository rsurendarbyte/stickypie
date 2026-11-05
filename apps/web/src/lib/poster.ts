import type { Product } from "@stickypie/shared";
import { packPosterSizes } from "@stickypie/shared";

/** Mini posters are tagged "mini poster" (and their slugs end in -mini-poster). */
export function isMiniPoster(product: Product) {
  return product.slug.endsWith("-mini-poster") || product.tags.some((t) => t.toLowerCase() === "mini poster");
}

/** Poster packs: a set of mini posters sold together (the product lists its posters). */
export function isPosterPack(product: Product) {
  return (product.packItems?.length ?? 0) > 0;
}

/** A wall setup: a poster pack shown on a painted wall (square picture). */
export function isWallSetup(product: Product) {
  return isPosterPack(product) && product.tags.some((t) => t.toLowerCase() === "wall setup");
}

const tagValue = (product: Product, name: string) =>
  product.tags.find((t) => t.startsWith(`wall ${name}:`))?.slice(name.length + 6) ?? null;

/** A wall's paint: "#c3cbbc,#b2bbaa" → CSS background. */
export function wallBackground(product: Product): { background: string } | null {
  const paint = tagValue(product, "paint");
  return paint ? { background: `linear-gradient(135deg, ${paint.split(",").join(", ")})` } : null;
}

/** Where each poster sits on a wall picture, in % of it. */
export function wallSpots(product: Product): { x: number; y: number; w: number; h: number }[] {
  const spots = tagValue(product, "spots");
  if (!spots) return [];
  return spots.split(";").map((spot) => {
    const [x, y, w, h] = spot.split(",").map(Number);
    return { x, y, w, h };
  });
}

/** How many of each size in a set, biggest first: "2 pcs 6×9 + 4 pcs 4×6 in". */
export function wallPosterSizes(product: Product): string {
  const sizes = packPosterSizes(product);
  const parts = [9, 6]
    .map((inches) => [sizes.filter((s) => s === inches).length, inches === 9 ? "6×9" : "4×6"] as const)
    .filter(([count]) => count > 0)
    .map(([count, size]) => `${count} ${count === 1 ? "pc" : "pcs"} ${size}`);
  return `${parts.join(" + ")} in`;
}

/** How much wall a set covers, from where its posters sit: "15 × 18 in". */
export function wallSize(product: Product): string | null {
  const spots = wallSpots(product);
  if (!spots.length) return null;
  const big = packPosterSizes(product)[0] > 6;
  const wide = Math.max(...spots.map((s) => s.x + s.w)) - Math.min(...spots.map((s) => s.x));
  const tall = Math.max(...spots.map((s) => s.y + s.h)) - Math.min(...spots.map((s) => s.y));
  return `${Math.round((wide * (big ? 6 : 4)) / spots[0].w)} × ${Math.round((tall * (big ? 9 : 6)) / spots[0].h)} in`;
}

const STATE_WORDS =
  /\b(kannada|karnataka|rajyotsava|tamil|pongal|telugu|telangana|andhra|kerala|malayalam|malayalee|onam|piravi|marathi|maharashtra|gujarat|gujarati|punjab|punjabi|bengal|bengali|odisha|odia|assam|assamese|bihu|rajasthan|puducherry|pondicherry|goa|bihar|jharkhand|manipur|mizoram|nagaland|sikkim|tripura|meghalaya|uttarakhand|himachal|haryana|namma)\b/i;

/** A name tied to one state, like a state's own festival. */
export function isRegionalName(name: string) {
  return STATE_WORDS.test(name);
}

/** Tied to one state or city (the Cities & States category, an India wall, a state's name): the hero leaves these out. */
export function isRegional(product: Product, regionCategoryId: string | undefined) {
  if (regionCategoryId && product.categoryIds.includes(regionCategoryId)) return true;
  if (product.tags.includes("wall theme:india")) return true;
  return isRegionalName(`${product.slug} ${product.name}`);
}

/** Tags that only drive the shop (row, size, paint, spots), never shown to shoppers. */
export function isInternalTag(tag: string) {
  return /^wall (theme|size|paint|spots):/.test(tag);
}

/** "Red Line — 6 Mini Poster Pack" → "Red Line": a set's name for shoppers. */
export function posterSetName(name: string) {
  return name.replace(/\s*—\s*\d+\s+Mini Poster Pack\s*$/i, "").trim() || name;
}

/** Anything printed on poster paper: a mini poster or a poster pack. */
export function isPoster(product: Product) {
  return isMiniPoster(product) || isPosterPack(product);
}

/** A size's name on its button: "6″" for stickers, the real 2:3 size ("4×6") for posters. */
export function sizeChipLabel(product: Product, inches: number): string {
  if (!isPoster(product)) return `${Math.round(inches * 10) / 10}″`;
  const short = Math.round(((inches * 2) / 3) * 10) / 10;
  return `${short}×${inches}`;
}
