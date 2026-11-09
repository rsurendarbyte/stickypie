"use client";

import { useState } from "react";
import type { PosterFinish, Product, ProductSize } from "@stickypie/shared";
import { PUZZLE_CARDS, formatINR, formatInches, priceForSize, productSizes, puzzleBuildInches, withFinish } from "@stickypie/shared";
import { isMiniPoster, isPosterPack, sizeChipLabel } from "@/lib/poster";
import { getFinish, useFinish } from "@/lib/poster-finish";
import type { CartProduct } from "./cart-context";

/** The lowest-priced size — what the shop shows first. */
export function defaultSize(product: Pick<Product, "sizes">): number | null {
  const sizes = productSizes(product);
  if (sizes.length === 0) return null;
  return [...sizes].sort((a, b) => a.price - b.price || a.inches - b.inches)[0].inches;
}

/** Selected size (lowest price first) + its price, for any buy surface. A puzzle poster has its own prices. */
export function useSizeChoice(base: Product, finish?: PosterFinish) {
  const product = withFinish(base, finish);
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

/**
 * The cart line's finish for this product: "sticker" or "puzzle" for a mini
 * poster bought as one. Cards pass `puzzle: false`: they always sell the poster
 * itself (puzzle posters have cards of their own).
 */
export function useLineFinish(product: Product, { puzzle = true }: { puzzle?: boolean } = {}): PosterFinish | undefined {
  const finish = useFinish();
  if (!isMiniPoster(product) || isPosterPack(product)) return undefined;
  return finish === "sticker" || (finish === "puzzle" && puzzle) ? finish : undefined;
}

/** "12×18 puzzle" — the poster a puzzle's 9 cards build. */
export function puzzleChipLabel(product: Product, cardInches: number): string {
  return `${sizeChipLabel(product, puzzleBuildInches(cardInches))}`;
}

/** What goes into the cart for this product in this size (finish: the page's choice unless given). */
export function toCartProduct(product: Product, size: number | null, price: number, chosen?: PosterFinish): CartProduct {
  const mini = isMiniPoster(product) && !isPosterPack(product);
  const finish = chosen ?? getFinish();
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price,
    imageUrl: product.imageUrl,
    thumbUrl: product.thumbUrl,
    stock: product.stock,
    size,
    sizeLabel:
      size === null
        ? null
        : isPosterPack(product)
          ? `${sizeChipLabel(product, size)} in posters`
          : mini && finish === "puzzle"
            ? `${puzzleChipLabel(product, size)} in puzzle · ${PUZZLE_CARDS} cards of ${sizeChipLabel(product, size)}`
            : mini
            ? `${sizeChipLabel(product, size)} in · ${finish === "sticker" ? "Sticker" : "Wall poster"}`
            : `${formatInches(size)}″`,
    ...(mini ? { finish } : {}),
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
  label = (inches) => `${formatInches(inches)}″`,
}: {
  sizes: ProductSize[];
  value: number | null;
  onChange: (inches: number) => void;
  compact?: boolean;
  disabled?: boolean;
  /** A size's name on its chip (poster packs: the real size, e.g. "4×6"). */
  label?: (inches: number) => string;
}) {
  if (sizes.length < 2 && compact) return null;
  if (sizes.length === 0) return null;

  if (compact) {
    return (
      <div
        role="radiogroup"
        aria-label="Sticker size"
        className="no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-snow/[0.06] p-0.5"
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
              {label(s.inches)}
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
      <div role="radiogroup" aria-label="Sticker size" className="mt-2 grid max-w-md grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
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
              <span className="block font-display text-base font-bold">{label(s.inches)}</span>
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
