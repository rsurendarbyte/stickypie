import type { Product } from "@stickypie/shared";

/** Mini posters are tagged "mini poster" (and their slugs end in -mini-poster). */
export function isMiniPoster(product: Product) {
  return product.slug.endsWith("-mini-poster") || product.tags.some((t) => t.toLowerCase() === "mini poster");
}
