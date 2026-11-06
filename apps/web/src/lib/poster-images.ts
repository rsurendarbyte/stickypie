// Picture of each poster, by product id, for pages that draw wall sets from
// their real posters. Filled from whatever catalogue the page already has.
import type { Product } from "@stickypie/shared";

const images = new Map<string, string>();

export function rememberPosters(products: Pick<Product, "id" | "thumbUrl" | "imageUrl">[]) {
  for (const p of products) images.set(p.id, p.thumbUrl ?? p.imageUrl);
}

/** A wall set's own posters, from the page, before anything on it draws the wall. */
export function rememberPackPosters(posters: { id: string; imageUrl: string }[]) {
  for (const p of posters) images.set(p.id, p.imageUrl);
}

/** A poster that isn't in the catalogue: the shopper's own picture. */
export function rememberPoster(id: string, url: string) {
  images.set(id, url);
}

export function posterImage(id: string): string | null {
  return images.get(id) ?? null;
}
