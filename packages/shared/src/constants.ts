export const BRAND_NAME = "StickyPie";
export const BRAND_TAGLINE = "Stick your style.";

export const CURRENCY = "INR";

/** Orders at or above this subtotal (₹) ship free. */
export const FREE_SHIPPING_THRESHOLD = 499;
/** Flat shipping fee (₹) below the free-shipping threshold. */
export const SHIPPING_FEE = 49;

/** Stock at or below this (and above 0) shows a "low stock" hint. */
export const LOW_STOCK_THRESHOLD = 3;

/** A product created within this many days gets a "New" badge. */
export const NEW_BADGE_DAYS = 14;

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
