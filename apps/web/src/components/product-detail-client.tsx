"use client";

import HoverLink from "./hover-link";
import { useState } from "react";
import { BadgeCheck, Droplets, PackageX, Ruler, Sun, Truck } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, discountPercent, formatINR } from "@stickypie/shared";
import { cardSkinFor, rotationFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import { useLiveProduct, useRelatedProducts } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import BackButton from "./back-button";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import ProductDetails from "./product-details";
import ProductReviews, { RatingSummary } from "./product-reviews";
import ProductPurchase from "./product-purchase";
import Row from "./row";
import SizePicker, { useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";

export default function ProductDetailClient({
  initial,
  category,
  related,
}: {
  initial: Product;
  category: { name: string; slug: string } | null;
  related: Product[];
}) {
  // Static snapshot first paint; live stock/price/availability from Supabase.
  const { product, unavailable } = useLiveProduct(initial.slug, initial);
  useWindowScrollMemory(true);
  // Live and on-sale only (never the build-time list).
  const { products: moreLikeThis, loaded: relatedLoaded } = useRelatedProducts(
    product.categoryId,
    product.id,
    related
  );

  const rotate = rotationFor(product.slug);
  // Same sticker sheet / cutting mat look as the home hero — new every load.
  const skin = cardSkinFor(product.slug, useSkinSeed());
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product);
  const off = discountPercent(price, compareAtPrice);
  const out = product.stock === 0;
  const [trueSize, setTrueSize] = useState(false);
  const low = product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;

  return (
    <>
      {/* Mat across the top of the page, fading softly into the page below */}
      <div
        aria-hidden
        style={skin.art}
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px] [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]"
      />
      <div className="flex items-center gap-3">
        <BackButton fallback={category ? `/stickers/${category.slug}` : "/stickers"} />
        <nav className="text-xs text-fog">
          <HoverLink href="/stickers" className="hover:text-snow">
            Stickers
          </HoverLink>
          {category && (
            <>
              <span className="mx-1.5">/</span>
              <HoverLink href={`/stickers/${category.slug}`} className="hover:text-snow">
                {category.name}
              </HoverLink>
            </>
          )}
        </nav>
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        {/* Art */}
        <div className="relative aspect-square max-h-[520px] w-full">
          <button
            type="button"
            onClick={() => setTrueSize(true)}
            aria-label="See actual size"
            className="absolute inset-0 grid cursor-zoom-in place-items-center p-8 sm:p-10"
            style={{ transform: `rotate(${rotate / 2}deg)` }}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`sticker-cut max-h-full max-w-full object-contain ${
                out || unavailable ? "opacity-50 saturate-50" : ""
              }`}
            />
          </button>
          <div className="absolute right-4 bottom-4">
            <button
              type="button"
              onClick={() => setTrueSize(true)}
              className="peel-btn peel-btn--light inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
            >
              <Ruler className="size-4" /> See actual size
            </button>
          </div>
          {off !== null && !unavailable && (
            <span className="pie-gradient absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-bold text-white">
              SAVE {off}%
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          {category && (
            <HoverLink
              href={`/stickers/${category.slug}`}
              className="inline-block rounded-full border border-line bg-ink2 px-3 py-1 text-xs font-medium text-fog transition-colors hover:text-snow"
            >
              {category.name}
            </HoverLink>
          )}
          <h1 className="mt-2.5 font-display text-3xl font-bold sm:text-4xl">{product.name}</h1>
          <RatingSummary productId={product.id} />

          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold text-gold">
              {formatINR(price)}
            </span>
            {compareAtPrice !== null && compareAtPrice > price && (
              <span className="text-lg text-fog line-through">
                {formatINR(compareAtPrice)}
              </span>
            )}
          </div>

          {unavailable ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-ink2 px-4 py-3 text-sm text-fog">
              <PackageX className="size-4 shrink-0 text-brand" />
              This sticker is currently not available for sale.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm">
                {out ? (
                  <span className="font-semibold text-brand">Out of stock — check back soon</span>
                ) : low ? (
                  <span className="font-semibold text-gold">
                    Only {product.stock} left — going fast
                  </span>
                ) : (
                  <span className="font-medium text-mint">In stock</span>
                )}
              </p>

              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-fog">
                {product.description}
              </p>

              {sizes.length > 0 && !out && (
                <div className="mt-5">
                  <SizePicker
                    sizes={sizes}
                    value={size}
                    onChange={setSize}
                  />
                </div>
              )}

              <ProductPurchase product={product} stickerSize={size} price={price} />
              {sizes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTrueSize(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-fog transition-colors hover:text-brand"
                >
                  <Ruler className="size-3.5" /> Not sure about the size? See it at actual size
                </button>
              )}
            </>
          )}

          <ul className="mt-6 grid max-w-md grid-cols-2 gap-2.5 text-xs text-fog">
            <li className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-mint" /> Premium die-cut vinyl
            </li>
            <li className="flex items-center gap-2">
              <Droplets className="size-4 text-mint" /> Waterproof &amp; scratch-proof
            </li>
            <li className="flex items-center gap-2">
              <Sun className="size-4 text-mint" /> UV &amp; fade resistant
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-mint" /> Ships in 2–4 days
            </li>
          </ul>

          {!unavailable && <ProductDetails size={sizes.length > 0 ? size : null} />}

          {product.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <HoverLink
                  key={tag}
                  href={`/stickers?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-panel px-3 py-1 text-xs text-fog transition-colors hover:text-snow"
                >
                  #{tag}
                </HoverLink>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {(!relatedLoaded || moreLikeThis.length > 0) && (
        <div className="mt-12 -mx-4 sm:-mx-8">
          <Row
            title="More like this"
            href={category ? `/stickers/${category.slug}` : "/stickers"}
          >
            {relatedLoaded
              ? moreLikeThis.map((p) => <ProductCard key={p.id} product={p} />)
              : Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} index={i} />)}
          </Row>
        </div>
      )}
      <TrueSizePreview
        open={trueSize}
        onClose={() => setTrueSize(false)}
        name={product.name}
        imageUrl={product.imageUrl}
        aspectRatio={product.aspectRatio}
        sizes={sizes}
        size={size}
        onSizeChange={setSize}
      />
    </>
  );
}
