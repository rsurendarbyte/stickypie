// Picture of each poster, by product id, for pages that draw wall sets from
// their real posters. Filled from whatever catalogue the page already has.
import type { Product } from "@stickypie/shared";

const images = new Map<string, string>();

export function rememberPosters(products: Pick<Product, "id" | "thumbUrl" | "imageUrl">[]) {
  for (const p of products) images.set(p.id, p.thumbUrl ?? p.imageUrl);
}

export function posterImage(id: string): string | null {
  return images.get(id) ?? null;
}
