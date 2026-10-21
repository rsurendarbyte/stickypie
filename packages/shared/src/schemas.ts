import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
  );

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
  state: z.string().trim().min(2, "Enter a state").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
});

export const checkoutSchema = z.object({
  customer: customerSchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
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
  categoryId: z.string().nullable().default(null),
  imageUrl: z.string().trim().min(1, "Pick or paste an image"),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  featured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).max(1000000).nullable().default(null),
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
