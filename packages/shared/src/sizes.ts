// Sticker sizes. The inch value is the sticker's LONGEST side; the other side
// follows the artwork's aspect ratio (width / height). Browser-safe, no deps.
import type { Product, ProductSize } from "./types";

/** Sizes offered by default for a new sticker; the admin can add any other whole-inch size. */
export const STICKER_SIZES = [3, 6, 7] as const;
/** Mini posters are 2:3 and sold in 4 × 6 and 6 × 9 in only (longest side 6, 9). */
export const POSTER_SIZES = [6, 9] as const;
/** A product is a mini poster when its slug ends in -mini-poster or it's tagged "mini poster". */
export function isMiniPosterProduct(product: { slug?: string; tags?: string[] } | null | undefined): boolean {
  return !!product && (!!product.slug?.endsWith("-mini-poster") || !!product.tags?.some((t) => t.toLowerCase() === "mini poster"));
}
/** What posters are, wherever the shop describes them: paper, not sticker vinyl. */
export const POSTER_PAPER = "300 GSM poster paper";
/** Posters have no sticky back, so every poster order comes with these. */
export const POSTER_ADHESIVE = "glue dots or double-sided tape";
/** A mini poster is sold as a wall poster (paper) or a sticker (vinyl); wall sets are paper only. */
export type PosterFinish = "poster" | "sticker";
/** How the choice reads on the order line, so printing knows the material. */
export function finishLabel(finish: PosterFinish): string {
  return finish === "sticker" ? "Vinyl sticker" : "300 GSM poster";
}
/** An order line printed on poster paper: a pack, or a mini poster not bought as a sticker. */
export function isPosterItem(item: { name: string; sizeLabel?: string | null; packPosters?: unknown[] | null }): boolean {
  if (item.packPosters?.length) return true;
  return /mini poster/i.test(item.name) && !/vinyl sticker/i.test(item.sizeLabel ?? "");
}
/** The usual sizes offered for a product: poster sizes for mini posters, sticker sizes otherwise. */
export function usualSizes(product: { slug?: string; tags?: string[] } | null | undefined): readonly number[] {
  return isMiniPosterProduct(product) ? POSTER_SIZES : STICKER_SIZES;
}
/** Allowed range for any size (whole inches, longest side). */
export const MIN_STICKER_INCHES = 1;
export const MAX_STICKER_INCHES = 48;
/** Most sizes one sticker can be sold in. */
export const MAX_SIZES_PER_STICKER = 10;

/** 3 → "3", 3.25 → "3.3" (one decimal, trailing .0 dropped). */
export function formatInches(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Printed width × height in inches for a size, or null without a known aspect ratio. */
export function sizeDimensions(
  inches: number,
  aspectRatio: number | null
): { width: number; height: number } | null {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  return aspectRatio >= 1
    ? { width: inches, height: inches / aspectRatio }
    : { width: inches * aspectRatio, height: inches };
}

/** "6 × 3.1 in" (or "6 in" when the aspect ratio is unknown). */
export function formatDimensions(inches: number, aspectRatio: number | null): string {
  const dims = sizeDimensions(inches, aspectRatio);
  if (!dims) return `${formatInches(inches)} in`;
  return `${formatInches(dims.width)} × ${formatInches(dims.height)} in`;
}

/** Stored on order lines so fulfilment knows exactly what to print: `6″ — 6 × 3.1 in`. */
export function sizeLabel(inches: number, aspectRatio: number | null): string {
  return `${formatInches(inches)}″ — ${formatDimensions(inches, aspectRatio)}`;
}

/** The product's sizes, smallest first. Empty = single-price product (no size choice). */
export function productSizes(product: Pick<Product, "sizes">): ProductSize[] {
  return [...(product.sizes ?? [])].sort((a, b) => a.inches - b.inches);
}

/** Price for the chosen size (or the single price when the product has no sizes). */
export function priceForSize(
  product: Pick<Product, "sizes" | "price" | "compareAtPrice">,
  inches: number | null
): { price: number; compareAtPrice: number | null } | null {
  const sizes = productSizes(product);
  if (sizes.length === 0) {
    return inches == null ? { price: product.price, compareAtPrice: product.compareAtPrice } : null;
  }
  const size = sizes.find((s) => s.inches === inches);
  return size ? { price: size.price, compareAtPrice: size.compareAtPrice } : null;
}

/** Keeps the product's headline price = its cheapest size, so lists can say "from ₹X". */
export function withSizePricing<T extends { sizes?: ProductSize[]; price?: number; compareAtPrice?: number | null }>(
  input: T
): T {
  if (!input.sizes || input.sizes.length === 0) return input;
  const cheapest = [...input.sizes].sort((a, b) => a.price - b.price)[0];
  return { ...input, price: cheapest.price, compareAtPrice: cheapest.compareAtPrice };
}

/**
 * Width / height read from an image file's header (PNG, JPEG, WebP, GIF).
 * Returns null for anything it can't parse.
 */
export function imageAspectFromBytes(bytes: Uint8Array): number | null {
  const ratio = (w: number, h: number) => (w > 0 && h > 0 ? w / h : null);
  const u16be = (o: number) => (bytes[o] << 8) | bytes[o + 1];
  const u16le = (o: number) => bytes[o] | (bytes[o + 1] << 8);
  const u24le = (o: number) => bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16);
  const u32be = (o: number) => ((bytes[o] << 24) >>> 0) + (bytes[o + 1] << 16) + (bytes[o + 2] << 8) + bytes[o + 3];
  const ascii = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));

  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    return ratio(u32be(16), u32be(20));
  }
  if (bytes.length >= 10 && ascii(0, 3) === "GIF") {
    return ratio(u16le(6), u16le(8));
  }
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return ratio(u24le(24) + 1, u24le(27) + 1);
    if (chunk === "VP8 ") return ratio(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
    if (chunk === "VP8L") {
      const b = bytes.slice(21, 25);
      const w = 1 + (((b[1] & 0x3f) << 8) | b[0]);
      const h = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
      return ratio(w, h);
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1];
      const len = u16be(o + 2);
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return ratio(u16be(o + 7), u16be(o + 5));
      }
      o += 2 + len;
    }
  }
  return null;
}

/** A poster pack poster's size: 6 → "4 × 6 in", 9 → "6 × 9 in" (posters are 2:3). */
export function posterSizeLabel(inches: number): string {
  return formatDimensions(inches, 2 / 3);
}

/** What's in a poster pack by size: "1 poster 6 × 9 in + 5 posters 4 × 6 in" (biggest first). */
export function packSizeSummary(sizes: number[]): string {
  const counts = new Map<number, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[0] - a[0])
    .map(([inches, n]) => `${n} poster${n === 1 ? "" : "s"} ${posterSizeLabel(inches)}`)
    .join(" + ");
}

/** A poster pack's sizes, one per poster (missing ones are 4 × 6 in). */
export function packPosterSizes(product: Pick<Product, "packItems" | "packSizes">): number[] {
  return product.packItems.map((_, i) => product.packSizes[i] ?? 6);
}
