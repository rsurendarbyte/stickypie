import type { Product } from "@stickypie/shared";
import { packPosterSizes, posterSizeLabel } from "@stickypie/shared";

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

/** A wall's size on the wall: "1.7 × 1.5 ft". */
export function wallSize(product: Product): string | null {
  return tagValue(product, "size");
}

/** Tags that only drive the shop (row, size), never shown to shoppers. */
export function isInternalTag(tag: string) {
  return /^wall (theme|size):/.test(tag);
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

/** What's in a poster pack, in a line: "1 big 6 × 9 in + 5 small 4 × 6 in" or "4 mini posters · each 4 × 6 in". */
export function packSizeLine(product: Product): string {
  const count = product.packItems.length;
  const big = packPosterSizes(product).filter((s) => s > 6).length;
  return big > 0
    ? `${big} big ${posterSizeLabel(9)} + ${count - big} small ${posterSizeLabel(6)}`
    : `${count} mini posters · each ${posterSizeLabel(6)}`;
}
