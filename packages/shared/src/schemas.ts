import { z } from "zod";
import { INDIAN_STATES, matchIndianState } from "./india";
import { MAX_SIZES_PER_STICKER, MAX_STICKER_INCHES, MIN_STICKER_INCHES } from "./sizes";
import { AVATAR_MAX_COVERS, AVATAR_MAX_PAGES, AVATAR_MAX_POSE_SETS, AVATAR_POSES_MAX, AVATAR_MAX_STYLE_IMAGES, AVATAR_MAX_STYLES, AVATAR_NOTE_MAX } from "./custom";

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
  );

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid colour");

/** QR / name sticker settings sent from the sticker makers. */
export const customSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("qr"),
    value: z.string().trim().min(1).max(300),
    label: z.string().max(22),
  }),
  z.object({
    kind: z.literal("text"),
    line1: z.string().trim().min(1).max(18),
    line2: z.string().max(30),
    font: z.enum(["bubbly", "comic", "script", "retro", "marker", "block"]),
    color: hexColor,
    color2: hexColor.nullable(),
    style: z.enum(["cut", "label"]),
  }),
  // One style per page — checkout also checks them against the book on sale.
  z.object({
    kind: z.literal("avatar"),
    pages: z.number().int().min(1).max(AVATAR_MAX_PAGES),
    styles: z.array(z.string().trim().min(1).max(30)).max(AVATAR_MAX_PAGES),
    note: z.string().trim().max(AVATAR_NOTE_MAX),
  }),
]);

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: phoneSchema,
  address1: z.string().trim().min(4, "Address is too short").max(120),
  address2: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  city: z.string().trim().min(2, "Enter a city").max(60),
  state: z
    .string()
    .trim()
    .transform((s) => matchIndianState(s) ?? s)
    .refine((s) => (INDIAN_STATES as readonly string[]).includes(s), "Choose your state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
});

export const checkoutSchema = z.object({
  customer: customerSchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        /** Chosen size in inches; omitted/null for single-size products. */
        size: z.number().int().positive().nullable().optional(),
        /** Custom stickers: id linking the line to artwork kept in the shopper's browser. */
        customRef: z.string().uuid().optional(),
        /** Custom stickers: "qr" / "text" = made on the site, "avatar" = a sticker book drawn from a photo (own price). */
        customKind: z.enum(["design", "qr", "text", "avatar"]).optional(),
        /** QR / name stickers: what to draw — saved instead of an image. Avatar books: pages + styles. */
        customSpec: customSpecSchema.optional(),
      })
    )
    .min(1, "Your cart is empty")
    .max(50),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only")
    .min(2)
    .max(80),
  description: z.string().trim().max(1000).default(""),
  price: z.number().int().min(1, "Price must be at least ₹1").max(1000000),
  compareAtPrice: z.number().int().min(1).max(1000000).nullable().default(null),
  categoryIds: z
    .array(z.string().min(1))
    .max(10, "Up to 10 categories")
    .default([])
    .transform((ids) => [...new Set(ids)]),
  imageUrl: z.string().trim().min(1, "Pick or paste an image"),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  featured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).max(1000000).nullable().default(null),
  sizes: z
    .array(
      z.object({
        inches: z
          .number()
          .int("Sizes are whole inches")
          .min(MIN_STICKER_INCHES, `Sizes start at ${MIN_STICKER_INCHES} inch`)
          .max(MAX_STICKER_INCHES, `Sizes go up to ${MAX_STICKER_INCHES} inches`),
        price: z.number().int().min(1, "Price must be at least ₹1").max(1000000),
        compareAtPrice: z.number().int().min(1).max(1000000).nullable().default(null),
      })
    )
    .max(MAX_SIZES_PER_STICKER, `Up to ${MAX_SIZES_PER_STICKER} sizes`)
    .refine((sizes) => new Set(sizes.map((s) => s.inches)).size === sizes.length, "Each size only once")
    .default([]),
  aspectRatio: z.number().positive().max(100).nullable().default(null),
  thumbUrl: z.string().trim().max(500).nullable().optional(),
});

export type ProductInputParsed = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only")
    .min(2)
    .max(40),
  sort: z.number().int().min(0).max(999).default(0),
});

export const fulfillmentStatusSchema = z.enum(["packed", "shipped", "delivered"]);

export const shipmentSchema = z.object({
  courier: z.string().trim().min(2, "Enter the courier name").max(60),
  trackingNumber: z.string().trim().min(3, "Enter the tracking number").max(60),
  trackingUrl: z
    .string()
    .trim()
    .url("Tracking link must be a full https:// URL")
    .max(300)
    .nullable()
    .default(null),
});

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  name: z.string().trim().max(80).default(""),
  /** 6-digit code emailed to prove the address belongs to the shopper. */
  code: z
    .string({ required_error: "Enter the 6-digit code from your email" })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const signupCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

const rupees = (label: string) =>
  z.number({ invalid_type_error: `Enter ${label}` }).int(`${label} must be whole rupees`).min(0).max(100000);

export const storeSettingsSchema = z.object({
  minOrder: rupees("the minimum order"),
  originPincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code")
    .nullable(),
  originState: z
    .string()
    .trim()
    .transform((s) => matchIndianState(s) ?? s)
    .refine((s) => (INDIAN_STATES as readonly string[]).includes(s), "Choose your state")
    .nullable(),
  business: z.object({
    name: z.string().trim().max(120).nullable().transform((s) => s || null),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .nullable()
      .transform((s) => s || null)
      .refine((s) => s === null || /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$/.test(s), "Enter a valid 15-character GSTIN"),
    address: z.string().trim().max(300).nullable().transform((s) => s || null),
    hsn: z.string().trim().regex(/^\d{4,8}$/, "HSN is 4–8 digits"),
    gstRate: z.number().min(0).max(28),
    invoicePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,8}$/, "Prefix: up to 8 letters/digits"),
  }),
  rates: z.object({
    local: rupees("the same-city rate"),
    state: rupees("the within-state rate"),
    national: rupees("the rest-of-India rate"),
    remote: rupees("the remote-area rate"),
  }),
  paymentGateway: z.enum(["cashfree", "razorpay"]).default("cashfree"),
  customPrices: z
    .record(z.string().regex(/^\d{1,2}$/), rupees("the custom sticker price"))
    .refine(
      (prices) =>
        Object.keys(prices).every((k) => Number(k) >= MIN_STICKER_INCHES && Number(k) <= MAX_STICKER_INCHES),
      `Custom sizes must be ${MIN_STICKER_INCHES}–${MAX_STICKER_INCHES} inches`
    )
    .default({}),
  qrPrices: z
    .record(z.string().regex(/^\d{1,2}$/), rupees("the QR sticker price"))
    .refine(
      (prices) =>
        Object.keys(prices).every((k) => Number(k) >= MIN_STICKER_INCHES && Number(k) <= MAX_STICKER_INCHES),
      `QR sizes must be ${MIN_STICKER_INCHES}–${MAX_STICKER_INCHES} inches`
    )
    .default({}),
  textPrices: z
    .record(z.string().regex(/^\d{1,2}$/), rupees("the name sticker price"))
    .refine(
      (prices) =>
        Object.keys(prices).every((k) => Number(k) >= MIN_STICKER_INCHES && Number(k) <= MAX_STICKER_INCHES),
      `Name sticker sizes must be ${MIN_STICKER_INCHES}–${MAX_STICKER_INCHES} inches`
    )
    .default({}),
  avatarBook: z
    .object({
      pages: z.number().int().min(1, "At least 1 pack").max(AVATAR_MAX_PAGES, `Minimum up to ${AVATAR_MAX_PAGES} packs`),
      price: rupees("the price per pack"),
      extra: rupees("the price per extra pack").default(0),
    })
    .default({ pages: 4, price: 0, extra: 0 }),
  avatarStyles: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Name every style").max(30, "Style names up to 30 letters"),
        covers: z
          .array(z.string().trim().min(1).max(500))
          .max(AVATAR_MAX_COVERS, `Up to ${AVATAR_MAX_COVERS} card pictures per style`)
          .default([]),
        images: z.array(z.string().trim().min(1).max(500)).max(AVATAR_MAX_STYLE_IMAGES, `Up to ${AVATAR_MAX_STYLE_IMAGES} samples per style`),
        poseSets: z
          .array(z.string().trim().min(1, "Each set needs its poses").max(AVATAR_POSES_MAX, `Poses up to ${AVATAR_POSES_MAX} letters a set`))
          .max(AVATAR_MAX_POSE_SETS, `Up to ${AVATAR_MAX_POSE_SETS} sets per style`)
          .optional(),
      })
    )
    .max(AVATAR_MAX_STYLES, `Up to ${AVATAR_MAX_STYLES} styles`)
    .refine((list) => new Set(list.map((s) => s.label.toLowerCase())).size === list.length, "Each style name only once")
    .default([]),
});
