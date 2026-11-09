// Share links and their preview pictures (server and browser). The pictures are
// 1200 × 630 JPEGs made by scripts/build-share-images.mjs, at fixed paths next
// to the poster's own artwork on the image host.

/** A poster's page. */
export const posterSharePath = (slug: string) => `/sticker/${slug}`;
/** A poster's puzzle: the page opens with the game already running. */
export const puzzleSharePath = (slug: string) => `/puzzle/${slug}`;

/** The link-preview picture for a poster (or its puzzle), or null without an image host. */
export function shareImageUrl(product: { slug: string; imageUrl: string }, kind: "poster" | "puzzle"): string | null {
  if (!/^https?:\/\//.test(product.imageUrl)) return null;
  return `${new URL(product.imageUrl).origin}/share/${product.slug}${kind === "puzzle" ? "-puzzle" : ""}.jpg`;
}
