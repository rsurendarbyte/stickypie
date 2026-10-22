// Custom stickers: the shopper picks a size and quantity, pays a fixed price
// per size (admin → Settings), then uploads their artwork from the order page
// after paying. Browser-safe, no deps.
import { formatInches } from "./sizes";

/** Supabase Storage bucket for uploaded artwork (public, random names). */
export const CUSTOM_STICKER_BUCKET = "custom-stickers";
/** Largest artwork file accepted. */
export const CUSTOM_STICKER_MAX_BYTES = 5 * 1024 * 1024;
export const CUSTOM_STICKER_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** Cart lines for custom stickers use `custom:<ref>` as their product id (one line per design). */
export const CUSTOM_PRODUCT_PREFIX = "custom:";
export const CUSTOM_STICKER_NAME = "Custom sticker";
export const QR_STICKER_NAME = "QR code sticker";
/**
 * Order statuses in which the shopper may upload / replace the artwork: only
 * "paid". Once the admin starts working on the order (packed onwards) the
 * design is locked.
 */
export const CUSTOM_UPLOAD_STATUSES = ["paid"] as const;

export function isCustomProductId(productId: string | null | undefined): boolean {
  return Boolean(productId?.startsWith(CUSTOM_PRODUCT_PREFIX));
}

/** Sizes on offer for custom stickers (price > 0), smallest first. */
export function customSizes(prices: Record<string, number>): { inches: number; price: number }[] {
  return Object.entries(prices)
    .map(([inches, price]) => ({ inches: Number(inches), price: Number(price) }))
    .filter((s) => Number.isFinite(s.inches) && s.inches > 0 && s.price > 0)
    .sort((a, b) => a.inches - b.inches);
}

/** "6″ custom — longest side 6 in", frozen on the order line for printing. */
export function customSizeLabel(inches: number): string {
  return `${formatInches(inches)}″ custom — longest side ${formatInches(inches)} in`;
}

/** Browser storage key for artwork picked before paying (uploaded once paid). */
export function customArtKey(ref: string): string {
  return `custom-art:${ref}`;
}
