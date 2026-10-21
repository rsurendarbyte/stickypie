const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format whole rupees: 1499 → "₹1,499". */
export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Is the sticker in this category? (Handles products cached before multi-category.) */
export function inCategory(
  product: { categoryId: string | null; categoryIds?: string[] },
  categoryId: string | null | undefined
): boolean {
  if (!categoryId) return false;
  return product.categoryIds ? product.categoryIds.includes(categoryId) : product.categoryId === categoryId;
}

/** Human-friendly order code derived from the order id. */
export function orderCode(orderId: string): string {
  return `SP-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
