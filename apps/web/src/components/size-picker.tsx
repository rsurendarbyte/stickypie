"use client";

import { useState } from "react";
import type { Product, ProductSize } from "@stickypie/shared";
import { formatINR, formatInches, priceForSize, productSizes } from "@stickypie/shared";
import type { CartProduct } from "./cart-context";

/** The lowest-priced size — what the shop shows first. */
export function defaultSize(product: Pick<Product, "sizes">): number | null {
  const sizes = productSizes(product);
  if (sizes.length === 0) return null;
  return [...sizes].sort((a, b) => a.price - b.price || a.inches - b.inches)[0].inches;
}

/** Selected size (lowest price first) + its price, for any buy surface. */
export function useSizeChoice(product: Product) {
  const sizes = productSizes(product);
  const [picked, setPicked] = useState<number | null>(null);
  const size =
    picked !== null && sizes.some((s) => s.inches === picked) ? picked : defaultSize(product);
  const priced = priceForSize(product, size) ?? {
    price: product.price,
    compareAtPrice: product.compareAtPrice,
  };
  return { sizes, size, setSize: setPicked, price: priced.price, compareAtPrice: priced.compareAtPrice };
}

/** What goes into the cart for this product in this size. */
export function toCartProduct(product: Product, size: number | null, price: number): CartProduct {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price,
    imageUrl: product.imageUrl,
    thumbUrl: product.thumbUrl,
    stock: product.stock,
    size,
    sizeLabel: size === null ? null : `${formatInches(size)}″`,
  };
}

/**
 * Size chips. `compact` = tiny chips for product cards; otherwise roomy
 * buttons with dimensions and price for the product page.
 */
export default function SizePicker({
  sizes,
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  sizes: ProductSize[];
  value: number | null;
  onChange: (inches: number) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  if (sizes.length < 2 && compact) return null;
  if (sizes.length === 0) return null;

  if (compact) {
    return (
      <div
        role="radiogroup"
        aria-label="Sticker size"
        className="inline-flex gap-0.5 rounded-full bg-white/90 p-0.5 shadow-[0_2px_8px_rgba(16,24,40,0.15)] ring-1 ring-black/5 backdrop-blur-sm"
      >
        {sizes.map((s) => {
          const active = s.inches === value;
          return (
            <button
              key={s.inches}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${s.inches} inch, ${formatINR(s.price)}`}
              disabled={disabled}
              onClick={() => onChange(s.inches)}
              className={`h-6 min-w-9 rounded-full px-2 text-[11px] font-bold transition-colors ${
                active ? "bg-snow text-white" : "text-fog hover:text-snow"
              }`}
            >
              {formatInches(s.inches)}″
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-fog uppercase">
        Size
      </p>
      <div role="radiogroup" aria-label="Sticker size" className="mt-2 grid max-w-md grid-cols-3 gap-2">
        {sizes.map((s) => {
          const active = s.inches === value;
          return (
            <button
              key={s.inches}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(s.inches)}
              className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                active
                  ? "border-brand bg-brand/[0.06] ring-1 ring-brand"
                  : "border-line bg-ink hover:border-snow/30"
              }`}
            >
              <span className="block font-display text-base font-bold">{formatInches(s.inches)}″</span>
              <span className={`mt-1 block text-sm font-bold ${active ? "text-brand" : "text-snow"}`}>
                {formatINR(s.price)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
