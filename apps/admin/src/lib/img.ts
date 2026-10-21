/**
 * Resolve product image URLs for admin previews. Relative paths like
 * /stickers/x.png live in the storefront app, so prefix its origin.
 * Client-safe (NEXT_PUBLIC_ var is inlined at build time).
 */
export function imageSrc(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

/** Same-origin link that downloads the image as a file named after the product. */
export function imageDownloadHref(url: string, name?: string): string {
  const params = new URLSearchParams({ url: imageSrc(url) });
  if (name) params.set("name", name);
  return `/api/image-download?${params}`;
}
