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
export const TEXT_STICKER_NAME = "Name sticker";
/** Kinds of custom sticker: an uploaded design, or a QR / name sticker drawn on the site. */
export type CustomKind = "design" | "qr" | "text";

/**
 * Fonts for name / text stickers. Each app (storefront, admin) loads the same
 * Google fonts and maps these ids to them, so the admin draws exactly what the
 * shopper saw.
 */
export const TEXT_STICKER_FONTS = [
  { id: "bubbly", label: "Bubbly", weight: 700 },
  { id: "comic", label: "Comic", weight: 400 },
  { id: "script", label: "Script", weight: 400 },
  { id: "retro", label: "Retro", weight: 400 },
  { id: "marker", label: "Marker", weight: 400 },
  { id: "block", label: "Block", weight: 400 },
] as const;
export type TextStickerFontId = (typeof TEXT_STICKER_FONTS)[number]["id"];

/**
 * What a QR or name sticker is made of. Saved on the order line instead of an
 * image — the admin draws the print file from it when downloading, so nothing
 * has to be uploaded after payment.
 */
export type QrStickerSpec = { kind: "qr"; value: string; label: string };
export type TextStickerSpec = {
  kind: "text";
  line1: string;
  line2: string;
  font: TextStickerFontId;
  color: string;
  /** Small line colour; null = automatic. */
  color2: string | null;
  style: "cut" | "label";
};
export type CustomSpec = QrStickerSpec | TextStickerSpec;
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
