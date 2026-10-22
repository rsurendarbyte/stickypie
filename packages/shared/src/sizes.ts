// Sticker sizes. The inch value is the sticker's LONGEST side; the other side
// follows the artwork's aspect ratio (width / height). Browser-safe, no deps.
import type { Product, ProductSize } from "./types";

export const STICKER_SIZES = [3, 6, 7] as const;

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
