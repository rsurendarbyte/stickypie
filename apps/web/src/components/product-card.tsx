"use client";

import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, discountPercent, formatINR } from "@stickypie/shared";
import { rotationFor } from "@/lib/palette";
import { lineKey, useCart } from "./cart-context";
import CartStepper from "./cart-stepper";
import SizePicker, { toCartProduct, useSizeChoice } from "./size-picker";

// E-commerce product card: die-cut art on a dark stage, prominent price with
// the discount called out, and an always-visible Add to cart button.
const TILE_BG =
  "radial-gradient(120% 95% at 50% 0%, #ffffff 0%, #fbfcfe 60%, #f2f4f8 100%)";

export default function ProductCard({
  product,
  width = "w-44 shrink-0 sm:w-48 md:w-52",
}: {
  product: Product;
  width?: string;
}) {
  const { add, items } = useCart();
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product);
  const inCart = items.find((item) => lineKey(item) === lineKey({ productId: product.id, size }));
  const inCartAnySize = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.qty, 0);
  const rotate = rotationFor(product.slug);
  const out = product.stock === 0;
  const low = product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const isNew = product.isNew;
  const off = discountPercent(price, compareAtPrice);

  function addToCart() {
    if (out) return;
    add(toCartProduct(product, size, price));
  }

  return (
    <div
      className={`group relative snap-start overflow-hidden rounded-2xl border border-line bg-ink transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_22px_44px_-16px_rgba(16,24,40,0.22)] ${width}`}
    >
      <Link href={`/sticker/${product.slug}`} className="block">
        {/* Art stage */}
        <div
          className="relative aspect-square overflow-hidden"
          style={{ backgroundImage: TILE_BG }}
        >
          <div className="bg-dots absolute inset-0 opacity-30" />
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/[0.025] to-transparent" />

          <div
            className="absolute inset-0 grid place-items-center p-5 transition-transform duration-300 [transform:rotate(var(--rot))] group-hover:[transform:rotate(0deg)]"
            style={{ "--rot": `${rotate}deg` } as React.CSSProperties}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className={`sticker-cut max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.06] ${
                out ? "opacity-40 saturate-50" : ""
              }`}
            />
          </div>

          <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
            {off !== null && (
              <span className="pie-gradient rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-md shadow-brand/30">
                {off}% OFF
              </span>
            )}
            {isNew && !out && (
              <span className="rounded-md bg-mint px-2 py-0.5 text-[10px] font-bold tracking-wider text-ink uppercase shadow-sm">
                New
              </span>
            )}
          </div>

          {inCartAnySize > 0 && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
            <Check className="size-3" strokeWidth={3.5} /> {inCartAnySize}
          </span>
        )}

        {low && (
            <span className="absolute bottom-2 left-2.5 rounded-md bg-snow/90 px-2 py-0.5 text-[10px] font-bold text-gold">
              Only {product.stock} left
            </span>
          )}
          {out && (
            <span className="absolute inset-x-0 bottom-0 bg-snow/85 py-1.5 text-center text-[10px] font-bold tracking-[0.18em] text-white/90 uppercase">
              Out of stock
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-h-[46px] px-3 pt-2.5">
          <p className="truncate text-[13px] font-medium text-snow/90">{product.name}</p>
          {compareAtPrice !== null && compareAtPrice > price && (
            <p className="mt-0.5 text-[11px] text-fog">
              <span className="line-through">{formatINR(compareAtPrice)}</span>{" "}
              <span className="font-bold text-mint">{off}% off</span>
            </p>
          )}
        </div>
      </Link>

      {/* Size chips (lowest price pre-selected), then the buy action */}
      {sizes.length > 1 && !out && (
        <div className="px-3 pt-2">
          <SizePicker
            compact
            sizes={sizes}
            value={size}
            onChange={setSize}
            aspectRatio={product.aspectRatio}
          />
        </div>
      )}
      <div className="flex p-3 pt-1.5">
        {inCart ? (
          <div className="flex h-10 w-full items-center justify-center gap-3 sm:h-11">
            <CartStepper item={inCart} size="sm" />
            <span className="font-display text-lg leading-none font-bold whitespace-nowrap">
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
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-full transition-all sm:h-11 sm:rounded-xl ${
            out
              ? "cursor-not-allowed bg-panel px-3.5 text-xs font-bold text-fog/60"
              : "bg-snow px-3 text-white shadow-[0_8px_20px_-8px_rgba(16,24,40,0.4)] hover:bg-snow/90 hover:shadow-[0_10px_24px_-8px_rgba(255,46,99,0.4)] active:scale-[0.98]"
          }`}
        >
          {out ? (
            "Out of stock"
          ) : (
            <>
              <ShoppingBag className="size-4 shrink-0 text-brand2" />
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
