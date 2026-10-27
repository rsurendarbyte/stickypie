// Pure snake_case row ⇄ camelCase model mappers. Browser-safe (no deps):
// used by the server-side Supabase driver AND the storefront's client-side
// live-catalog fetches against the Supabase REST API.
import type { Category, Order, OrderItem, Product, ProductInput } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function rowToCategory(r: any): Category {
  return { id: r.id, name: r.name, slug: r.slug, sort: r.sort };
}

// The production storefront serves sticker images from its own cached domain
// (NEXT_PUBLIC_IMAGE_HOST, e.g. https://stickers.stickypie.in) instead of the
// bucket's r2.dev address. Same files, same bucket — only the host changes, so
// links saved with either host work. Unset (dev, admin) → links as stored.
const R2_DEV_HOST = /^https:\/\/pub-[a-z0-9]+\.r2\.dev(?=\/)/;
function onImageHost(url: string): string {
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST;
  return host && url ? url.replace(R2_DEV_HOST, host.replace(/\/+$/, "")) : url;
}

export function rowToProduct(r: any): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    price: r.price,
    compareAtPrice: r.compare_at_price,
    categoryId: r.category_id ?? null,
    // Absent until the multi-category migration runs — just the main one.
    categoryIds: Array.isArray(r.category_ids) ? r.category_ids : r.category_id ? [r.category_id] : [],
    imageUrl: onImageHost(r.image_url),
    thumbUrl: r.thumb_url ? onImageHost(r.thumb_url) : null,
    tags: r.tags ?? [],
    featured: r.featured,
    // Absent until the 20261021 migration runs — treat as "not new".
    isNew: r.is_new ?? false,
    isActive: r.is_active,
    stock: r.stock,
    // Absent until the 20261022 migration runs — a single-size product.
    sizes: Array.isArray(r.sizes)
      ? r.sizes.map((s: any) => ({
          inches: Number(s.inches),
          price: Number(s.price),
          compareAtPrice: s.compare_at_price == null ? null : Number(s.compare_at_price),
        }))
      : [],
    aspectRatio: r.aspect_ratio == null ? null : Number(r.aspect_ratio),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToItem(r: any): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    name: r.name,
    unitPrice: r.unit_price,
    quantity: r.quantity,
    imageUrl: r.image_url ?? "",
    sizeInches: r.size_inches ?? null,
    sizeLabel: r.size_label ?? null,
    isCustom: Boolean(r.is_custom),
    customFile: r.custom_file ?? null,
    customRef: r.custom_ref ?? null,
    customSpec: r.custom_spec ?? null,
    finishedFiles: Array.isArray(r.finished_files) ? r.finished_files.filter((u: unknown) => typeof u === "string") : [],
  };
}

export function rowToOrder(r: any): Order {
  return {
    id: r.id,
    status: r.status,
    customerName: r.customer_name,
    email: r.email,
    phone: r.phone,
    address1: r.address1,
    address2: r.address2,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    subtotal: r.subtotal,
    shippingFee: r.shipping_fee,
    gstAmount: r.gst_amount ?? null,
    gstRate: r.gst_rate == null ? null : Number(r.gst_rate),
    total: r.total,
    paymentProvider: r.payment_provider,
    cfOrderId: r.cf_order_id,
    cfPaymentId: r.cf_payment_id,
    paymentNote: r.payment_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    paidAt: r.paid_at,
    userId: r.user_id ?? null,
    packedAt: r.packed_at ?? null,
    shippedAt: r.shipped_at ?? null,
    deliveredAt: r.delivered_at ?? null,
    courier: r.courier ?? null,
    trackingNumber: r.tracking_number ?? null,
    trackingUrl: r.tracking_url ?? null,
    invoiceNumber: r.invoice_number ?? null,
    invoiceDate: r.invoice_date ?? null,
    shiprocketOrderId: r.shiprocket_order_id ?? null,
    shiprocketShipmentId: r.shiprocket_shipment_id ?? null,
    labelUrl: r.shipping_label_url ?? null,
    courierStatus: r.courier_status ?? null,
    courierStatusAt: r.courier_status_at ?? null,
    items: Array.isArray(r.order_items) ? r.order_items.map(rowToItem) : [],
  };
}

export function productToRow(input: Partial<ProductInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.slug !== undefined) row.slug = input.slug;
  if (input.description !== undefined) row.description = input.description;
  if (input.price !== undefined) row.price = input.price;
  if (input.compareAtPrice !== undefined) row.compare_at_price = input.compareAtPrice;
  if (input.categoryIds !== undefined) {
    row.category_ids = input.categoryIds;
    row.category_id = input.categoryIds[0] ?? null;
  }
  if (input.imageUrl !== undefined) row.image_url = input.imageUrl;
  if (input.thumbUrl !== undefined) row.thumb_url = input.thumbUrl;
  if (input.tags !== undefined) row.tags = input.tags;
  if (input.featured !== undefined) row.featured = input.featured;
  if (input.isNew !== undefined) row.is_new = input.isNew;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  if (input.stock !== undefined) row.stock = input.stock;
  if (input.sizes !== undefined) {
    row.sizes = input.sizes.map((s) => ({
      inches: s.inches,
      price: s.price,
      compare_at_price: s.compareAtPrice,
    }));
  }
  if (input.aspectRatio !== undefined) row.aspect_ratio = input.aspectRatio;
  return row;
}
