"use client";

import PageLink from "./page-link";
import { useState } from "react";
import { Check, Ruler, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, discountPercent, formatINR } from "@stickypie/shared";
import { cardSkinFor, rotationFor } from "@/lib/palette";
import { isMiniPoster } from "@/lib/poster";
import { useSkinSeed } from "@/lib/skin-seed";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import SizePicker, { toCartProduct, useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";

// E-commerce product card: die-cut art on its own sticker sheet or cutting
// mat, prominent price with the discount called out, and an always-visible
// sticker-style Add to cart button. Mini posters keep the same card size but
// show the whole poster as a print taped to a soft wall instead of a die-cut.


/** Width ÷ height of the poster stage's inner area (square art minus padding). */
const POSTER_STAGE_RATIO = 1;

/** "Jimny — The Adventure Awaits Mini Poster" → "Jimny — The Adventure Awaits". */
export function posterTitle(name: string) {
  return name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;
}

export default function ProductCard({
  product,
  width = "w-44 shrink-0 sm:w-48 md:w-52",
}: {
  product: Product;
  width?: string;
}) {
  const poster = isMiniPoster(product);
  const { add, items } = useCart();
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product);
  const inCart = items.find((item) => lineKey(item) === lineKey({ productId: product.id, size }));
  const inCartAnySize = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.qty, 0);
  const rotate = rotationFor(product.slug);
  const skin = cardSkinFor(product.slug, useSkinSeed());
  const out = product.stock === 0;
  const low = product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const isNew = product.isNew;
  const off = discountPercent(price, compareAtPrice);
  const [trueSize, setTrueSize] = useState(false);

  function addToCart() {
    if (out) return;
    add(toCartProduct(product, size, price));
  }

  return (
    <div
      style={{ backgroundColor: poster ? undefined : skin.card }}
      className={`group relative snap-start overflow-hidden rounded-2xl border border-line transition-all ${poster ? "bg-white" : ""} duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] ${width}`}
    >
      {/* Art stage — the sticker, plus only the NEW badge and the actual-size button */}
      <div className="relative">
      <PageLink href={`/sticker/${product.slug}`} className="block" tabIndex={-1} aria-hidden>
        {poster ? (
          <div className="poster-wall relative aspect-square overflow-hidden">
            <div
              className="absolute inset-x-4 top-5 bottom-3 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center transition-transform duration-300 [transform:rotate(var(--rot))] group-hover:[transform:rotate(0deg)]"
              style={{ "--rot": `${rotate / 2}deg` } as React.CSSProperties}
            >
              {/* The print keeps the poster's own shape: full height for tall posters
                  (most), full width for squarer ones — so the tape sits on its top edge. */}
              <span
                className="relative block max-h-full max-w-full transition-transform duration-300 group-hover:scale-[1.03]"
                style={
                  (product.aspectRatio ?? 0.6) >= POSTER_STAGE_RATIO
                    ? { width: "100%", aspectRatio: product.aspectRatio ?? 0.6 }
                    : { height: "100%", aspectRatio: product.aspectRatio ?? 0.6 }
                }
              >
                <img
                  src={product.thumbUrl ?? product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className={`poster-print block size-full object-cover ${out ? "opacity-40 saturate-50" : ""}`}
                />
                <span aria-hidden className="poster-tape absolute -top-2 left-1/2 -ml-6 -rotate-3" />
              </span>
            </div>
            {/* "Mini poster" on a strip of masking tape stuck at the top right, on the
                wall beside the poster (never over the art) — on the art stage, so the
                card's info rows keep the same height as a sticker card's */}
            <span className="poster-tape-wrap absolute -top-0.5 right-2.5 rotate-[3deg]">
              <span className="poster-tape-label block pt-3 pr-[6px] pb-3 pl-[6px] font-display text-[9px] leading-none font-bold tracking-[0.2em] uppercase [writing-mode:vertical-rl]">
                Mini poster
              </span>
            </span>
            {isNew && !out && (
              <span className="absolute top-2.5 left-2.5 rounded-md bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-ink uppercase shadow-sm">
                New
              </span>
            )}
          </div>
        ) : (
        <div className="relative aspect-square overflow-hidden" style={skin.art}>
          <div
            className="absolute inset-0 grid place-items-center p-5 transition-transform duration-300 [transform:rotate(var(--rot))] group-hover:[transform:rotate(0deg)]"
            style={{ "--rot": `${rotate}deg` } as React.CSSProperties}
          >
            <img
              src={product.thumbUrl ?? product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={`sticker-cut max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.06] ${
                out ? "opacity-40 saturate-50" : ""
              }`}
            />
          </div>
          {isNew && !out && (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-ink uppercase shadow-sm">
              New
            </span>
          )}
        </div>
        )}
      </PageLink>
      {sizes.length > 0 && (
        <button
          type="button"
          onClick={() => setTrueSize(true)}
          aria-label={`See ${product.name} at actual size`}
          title="See actual size"
          className={`absolute ${poster ? "right-2.5 bottom-2.5" : "top-2.5 right-2.5"} grid size-7 place-items-center rounded-full bg-white/90 text-fog shadow-[0_2px_8px_rgba(16,24,40,0.15)] ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:text-brand`}
        >
          <Ruler className="size-3.5" />
        </button>
      )}
      </div>

      {/* Info — fixed-height rows so every card lines up */}
      <div className="px-3 pt-2.5">
        <PageLink href={`/sticker/${product.slug}`} className="block">
          <p className="truncate text-[13px] font-medium text-snow/90">{poster ? posterTitle(product.name) : product.name}</p>
        </PageLink>
        <div className="mt-1 flex h-[18px] items-center gap-1.5 overflow-hidden text-[11px] whitespace-nowrap">
          {compareAtPrice !== null && compareAtPrice > price && (
            <>
              <span className="text-fog line-through">{formatINR(compareAtPrice)}</span>
              {off !== null && <span className="font-bold text-mint">{off}% off</span>}
            </>
          )}
          <span className="ml-auto flex items-center gap-1">
            {out ? (
              <Tag className="bg-panel text-fog">Sold out</Tag>
            ) : low ? (
              <Tag className="bg-gold/15 text-gold">Only {product.stock} left</Tag>
            ) : null}
            {inCartAnySize > 0 && (
              <Tag className="bg-mint text-white">
                <Check className="size-2.5" strokeWidth={3.5} /> {inCartAnySize}
              </Tag>
            )}
          </span>
        </div>
        <div className="mt-2 flex h-7 items-center">
          {sizes.length > 1 && !out && <SizePicker compact sizes={sizes} value={size} onChange={setSize} />}
        </div>
      </div>
      {trueSize && (
        <TrueSizePreview
          open
          onClose={() => setTrueSize(false)}
          name={product.name}
          imageUrl={product.imageUrl}
          aspectRatio={product.aspectRatio}
          sizes={sizes}
          size={size}
          onSizeChange={setSize}
        />
      )}

      {/* Buy action: stepper once this size is in the cart, otherwise add-with-price */}
      <div className="flex p-3 pt-2">
        {inCart ? (
          // Stepper pinned left, price right — changing digits never shifts the buttons.
          <div className="flex h-10 w-full items-center justify-between gap-2 sm:h-11">
            <CartStepper item={inCart} size="sm" sticker />
            <span className="text-right font-display text-lg leading-none font-bold whitespace-nowrap tabular-nums">
              {formatINR(inCart.qty * inCart.price)}
            </span>
          </div>
        ) : (
        <button
          type="button"
          onClick={addToCart}
          disabled={out}
          aria-label={
            out
              ? "Out of stock"
              : `Add ${product.name}${size ? ` (${size} inch)` : ""} to cart for ${formatINR(price)}`
          }
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl sm:h-11 ${
            out ? "cursor-not-allowed bg-panel px-3.5 text-xs font-bold text-fog/60" : "peel-btn px-3"
          }`}
        >
          {out ? (
            "Out of stock"
          ) : (
            <>
              <ShoppingBag className="peel-icon size-4 shrink-0" />
              <span className="font-display text-lg leading-none font-bold whitespace-nowrap">
                {formatINR(price)}
              </span>
            </>
          )}
        </button>
        )}
      </div>
    </div>
  );
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-bold uppercase ${className}`}>
      {children}
    </span>
  );
}
