import type { Product } from "@stickypie/shared";

/** Mini posters are tagged "mini poster" (and their slugs end in -mini-poster). */
export function isMiniPoster(product: Product) {
  return product.slug.endsWith("-mini-poster") || product.tags.some((t) => t.toLowerCase() === "mini poster");
}

/** Poster packs: a set of mini posters sold together (the product lists its posters). */
export function isPosterPack(product: Product) {
  return (product.packItems?.length ?? 0) > 0;
}


/** A size's name on its button: "6″" for stickers, the real 2:3 size ("4×6") for a poster pack's posters. */
export function sizeChipLabel(product: Product, inches: number): string {
  if (!isPosterPack(product)) return `${Math.round(inches * 10) / 10}″`;
  const short = Math.round(((inches * 2) / 3) * 10) / 10;
  return `${short}×${inches}`;
}
