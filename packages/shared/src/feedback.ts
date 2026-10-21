// Contact form messages + product reviews. Browser-safe (types, schemas, mappers).
import { z } from "zod";

export const CONTACT_TOPICS = {
  order: "An order I placed",
  custom: "Custom stickers",
  bulk: "Bulk / business order",
  feedback: "Feedback or idea",
  general: "Something else",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderCode: string | null;
  topic: ContactTopic;
  message: string;
  status: "new" | "resolved";
  createdAt: string;
};
export type ContactInput = Omit<ContactMessage, "id" | "status" | "createdAt" | "phone"> & { phone: string };

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string({ required_error: "Enter your mobile number" })
    .trim()
    .transform((s) => s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
    .refine((s) => /^[6-9]\d{9}$/.test(s), "Enter a valid 10-digit mobile number"),
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .transform((s) => s || null)
    .nullable()
    .optional()
    .transform((s) => s ?? null),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]).default("general"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  /** Honeypot — real people never see or fill this. */
  website: z.string().max(200).optional(),
});

export type ReviewStatus = "pending" | "approved" | "rejected";

export type PublicReview = {
  id: string;
  productId: string | null;
  authorName: string;
  rating: number;
  body: string | null;
  /** Shopper's photo (public URL), if they added one. */
  photoUrl: string | null;
  createdAt: string;
};

/** Supabase Storage bucket for review photos. */
export const REVIEW_PHOTO_BUCKET = "review-photos";
/** Largest photo the server accepts (the browser shrinks it first). */
export const REVIEW_PHOTO_MAX_BYTES = 1024 * 1024;

export type Review = PublicReview & {
  /** Storage object path (for deleting the photo). */
  photoPath: string | null;
  orderId: string;
  orderItemId: string;
  userId: string;
  status: ReviewStatus;
  reviewedAt: string | null;
};

export type NewReviewInput = {
  productId: string | null;
  orderId: string;
  orderItemId: string;
  userId: string;
  authorName: string;
  rating: number;
  body: string | null;
  photoPath: string | null;
  photoUrl: string | null;
};

export const reviewInputSchema = z.object({
  orderId: z.string().uuid(),
  /** "item" = one sticker (orderItemId); "order" = every sticker not yet reviewed. */
  scope: z.enum(["item", "order"]).default("item"),
  orderItemId: z.string().uuid().optional(),
  rating: z.number().int().min(1, "Pick 1 to 5 stars").max(5),
  body: z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters")
    .optional()
    .nullable()
    .transform((s) => s || null),
});

/** "Asha Rao" → "Asha R." — what shoppers see on a review. */
export function reviewAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "StickyPie customer";
  const first = parts[0].slice(0, 30);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToContact(r: any): ContactMessage {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    orderCode: r.order_code ?? null,
    topic: r.topic,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function rowToPublicReview(r: any): PublicReview {
  return {
    id: r.id,
    productId: r.product_id ?? null,
    authorName: r.author_name,
    rating: Number(r.rating),
    body: r.body ?? null,
    photoUrl: r.photo_url ?? null,
    createdAt: r.created_at,
  };
}

export function rowToReview(r: any): Review {
  return {
    ...rowToPublicReview(r),
    photoPath: r.photo_path ?? null,
    orderId: r.order_id,
    orderItemId: r.order_item_id,
    userId: r.user_id,
    status: r.status,
    reviewedAt: r.reviewed_at ?? null,
  };
}
