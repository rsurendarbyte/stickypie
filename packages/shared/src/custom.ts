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
export const AVATAR_STICKER_NAME = "Avatar sticker packs";
/**
 * Kinds of custom sticker: an uploaded design, a QR / name sticker drawn on
 * the site, or avatar sticker sheets (AI stickers of the shopper from their photo).
 */
export type CustomKind = "design" | "qr" | "text" | "avatar";

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
/**
 * Avatar sticker sheets: the shopper's photo is uploaded after paying (like a
 * custom design); they pick one style per sheet (90s retro, anime, action
 * figure…) and we make each sheet with AI, then show them on the order page.
 */
export type AvatarStickerSpec = {
  kind: "avatar";
  /** Pages in the book (one style each). */
  pages: number;
  /** Style names, page 1 first (frozen as named when ordered). */
  styles: string[];
  /** Anything else for the artist, e.g. "with my bike". */
  note: string;
  /** A couple photo: both people in every sticker. Absent = just one person. */
  couple?: boolean;
};
export type CustomSpec = QrStickerSpec | TextStickerSpec | AvatarStickerSpec;

/**
 * A style the shopper can pick for a page (admin → Avatar book): a card
 * picture of one avatar in that style, and sample sheets (e.g. a girl's and a
 * boy's) shown when the shopper taps Samples.
 */
/** covers: the card pictures (one avatar each, e.g. a girl and a boy) the style card rotates between. */
export type AvatarStyle = {
  label: string;
  covers: string[];
  images: string[];
  /**
   * Admin-only: the poses of each sample-sheet set (Set 1, Set 2…), each a
   * comma-separated list, for the AI prompts. Unset = the built-in sets.
   */
  poseSets?: string[];
};
/** Most card pictures per style. */
export const AVATAR_MAX_COVERS = 2;
/** Most pose sets per style, and the longest pose list. */
export const AVATAR_MAX_POSE_SETS = 10;
export const AVATAR_POSES_MAX = 600;
/** Most sample images per style. */
export const AVATAR_MAX_STYLE_IMAGES = 6;
export const AVATAR_MAX_STYLES = 30;
/** Most pages a book can have. */
export const AVATAR_MAX_PAGES = 12;
export const AVATAR_NOTE_MAX = 120;

/** Starting styles until the admin sets their own (the first sixteen ship with sample sheets). */
export const DEFAULT_AVATAR_STYLES: AvatarStyle[] = [
  {
    label: "90s Retro",
    covers: ["/avatar-samples/90s-retro-cover.webp", "/avatar-samples/90s-retro-cover-boy.webp"],
    images: ["/avatar-samples/90s-retro-girl.webp", "/avatar-samples/90s-retro-boy.webp"],
  },
  {
    label: "Anime",
    covers: ["/avatar-samples/anime-cover.webp", "/avatar-samples/anime-cover-boy.webp"],
    images: ["/avatar-samples/anime-girl.webp", "/avatar-samples/anime-boy.webp"],
  },
  {
    label: "Chibi",
    covers: ["/avatar-samples/chibi-cover.webp", "/avatar-samples/chibi-cover-boy.webp"],
    images: ["/avatar-samples/chibi-girl.webp", "/avatar-samples/chibi-boy.webp"],
  },
  {
    label: "Comic Book",
    covers: ["/avatar-samples/comic-cover.webp", "/avatar-samples/comic-cover-boy.webp"],
    images: ["/avatar-samples/comic-girl.webp", "/avatar-samples/comic-boy.webp"],
  },
  {
    label: "Action Figure",
    covers: ["/avatar-samples/action-figure-cover.webp", "/avatar-samples/action-figure-cover-boy.webp"],
    images: ["/avatar-samples/action-figure-girl.webp", "/avatar-samples/action-figure-boy.webp"],
  },
  {
    label: "3D Cartoon",
    covers: ["/avatar-samples/3d-cartoon-cover.webp", "/avatar-samples/3d-cartoon-cover-boy.webp"],
    images: ["/avatar-samples/3d-cartoon-girl.webp", "/avatar-samples/3d-cartoon-boy.webp"],
  },
  {
    label: "Pixel Art",
    covers: ["/avatar-samples/pixel-art-cover.webp", "/avatar-samples/pixel-art-cover-boy.webp"],
    images: ["/avatar-samples/pixel-art-girl.webp", "/avatar-samples/pixel-art-boy.webp"],
  },
  {
    label: "Clay Toy",
    covers: ["/avatar-samples/clay-toy-cover.webp", "/avatar-samples/clay-toy-cover-boy.webp"],
    images: ["/avatar-samples/clay-toy-girl.webp", "/avatar-samples/clay-toy-boy.webp"],
  },
  {
    label: "Bollywood Poster",
    covers: ["/avatar-samples/bollywood-cover.webp", "/avatar-samples/bollywood-cover-boy.webp"],
    images: ["/avatar-samples/bollywood-girl.webp", "/avatar-samples/bollywood-boy.webp"],
  },
  {
    label: "Superhero",
    covers: ["/avatar-samples/superhero-cover.webp", "/avatar-samples/superhero-cover-boy.webp"],
    images: ["/avatar-samples/superhero-girl.webp", "/avatar-samples/superhero-boy.webp"],
  },
  {
    label: "Pencil Sketch",
    covers: ["/avatar-samples/pencil-sketch-cover.webp", "/avatar-samples/pencil-sketch-cover-boy.webp"],
    images: ["/avatar-samples/pencil-sketch-girl.webp", "/avatar-samples/pencil-sketch-boy.webp"],
  },
  {
    label: "Watercolour Storybook",
    covers: ["/avatar-samples/storybook-cover.webp", "/avatar-samples/storybook-cover-boy.webp"],
    images: ["/avatar-samples/storybook-girl.webp", "/avatar-samples/storybook-boy.webp"],
  },
  {
    label: "Street Graffiti",
    covers: ["/avatar-samples/graffiti-cover.webp", "/avatar-samples/graffiti-cover-boy.webp"],
    images: ["/avatar-samples/graffiti-girl.webp", "/avatar-samples/graffiti-boy.webp"],
  },
  {
    label: "Desi Festive",
    covers: ["/avatar-samples/desi-cover.webp", "/avatar-samples/desi-cover-boy.webp"],
    images: ["/avatar-samples/desi-girl.webp", "/avatar-samples/desi-boy.webp"],
  },
  {
    label: "K-Pop Idol",
    covers: ["/avatar-samples/kpop-cover.webp", "/avatar-samples/kpop-cover-boy.webp"],
    images: ["/avatar-samples/kpop-girl.webp", "/avatar-samples/kpop-boy.webp"],
  },
  {
    label: "Pop Art",
    covers: ["/avatar-samples/pop-art-cover.webp", "/avatar-samples/pop-art-cover-boy.webp"],
    images: ["/avatar-samples/pop-art-girl.webp", "/avatar-samples/pop-art-boy.webp"],
  },
  ...[
    "Cricket Star",
    "Cyberpunk Neon",
    "Plush Toy",
    "Big-Head Vinyl Toy",
    "Renaissance Portrait",
  ].map((label): AvatarStyle => ({ label, covers: [], images: [] })),
];

/**
 * Avatar sticker sheets on sale (admin → Avatar sheets): one sheet per picked
 * style, at least `pages` sheets, `price` rupees per sheet. Price 0 = not offered.
 */
export type AvatarBook = {
  pages: number;
  price: number;
  /** Rupees per pack after the minimum; 0 = the same as `price`. */
  extra: number;
};

/** The offer if it's on (minimum and price set, enough styles to pick the minimum), else null. */
export function avatarBook(settings: { avatarBook: AvatarBook; avatarStyles: AvatarStyle[] }): AvatarBook | null {
  const book = settings.avatarBook;
  return book.pages > 0 && book.pages <= AVATAR_MAX_PAGES && book.price > 0 && settings.avatarStyles.length >= book.pages
    ? book
    : null;
}

/** Most sheets one order can have: every style, up to the cap. */
export function avatarMaxSheets(styles: number): number {
  return Math.min(styles, AVATAR_MAX_PAGES);
}

/** Rupees for each pack after the minimum. */
export function avatarExtraPrice(book: AvatarBook): number {
  return book.extra > 0 ? book.extra : book.price;
}

/** Price of `sheets` sheets: the minimum at `price` each, every one after at the extra price. */
export function avatarSheetsPrice(book: AvatarBook, sheets: number): number {
  return book.pages * book.price + Math.max(sheets - book.pages, 0) * avatarExtraPrice(book);
}

/** "4 avatar sticker packs" (or "4 couple avatar sticker packs"), frozen on the order line. */
export function avatarBookLabel(pages: number, couple = false): string {
  return `${pages} ${couple ? "couple " : ""}avatar sticker pack${pages === 1 ? "" : "s"}`;
}

/**
 * Lines whose picture the shopper sends after paying: uploaded designs and
 * avatar photos (QR / name stickers are drawn from their details instead).
 */
export function needsArtwork(item: { isCustom: boolean; customSpec: CustomSpec | null }): boolean {
  return item.isCustom && (!item.customSpec || item.customSpec.kind === "avatar");
}
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
