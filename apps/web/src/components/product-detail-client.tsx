"use client";

import Link from "next/link";
import { BadgeCheck, Droplets, PackageX, Sun, Truck } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, discountPercent, formatINR } from "@stickypie/shared";
import { rotationFor } from "@/lib/palette";
import { useLiveProduct } from "@/lib/live-catalog";
import BackButton from "./back-button";
import ProductCard from "./product-card";
import ProductPurchase from "./product-purchase";
import Row from "./row";

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

  const rotate = rotationFor(product.slug);
  const off = discountPercent(product.price, product.compareAtPrice);
  const out = product.stock === 0;
  const low = product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;

  return (
    <>
      <div className="flex items-center gap-3">
        <BackButton fallback={category ? `/browse?category=${category.slug}` : "/browse"} />
        <nav className="text-xs text-fog">
          <Link href="/browse" className="hover:text-snow">
            Browse
          </Link>
          {category && (
            <>
              <span className="mx-1.5">/</span>
              <Link href={`/browse?category=${category.slug}`} className="hover:text-snow">
                {category.name}
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
        {/* Art */}
        <div
          className="relative aspect-square max-h-[520px] w-full overflow-hidden rounded-3xl border border-line bg-ink shadow-[0_24px_60px_-24px_rgba(16,24,40,0.25)]">
          <div className="bg-dots absolute inset-0 opacity-35" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/[0.03] to-transparent" />
          <div
            className="absolute inset-0 grid place-items-center p-8 sm:p-10"
            style={{ transform: `rotate(${rotate / 2}deg)` }}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className={`sticker-cut max-h-full max-w-full object-contain ${
                out || unavailable ? "opacity-50 saturate-50" : ""
              }`}
            />
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
            <Link
              href={`/browse?category=${category.slug}`}
              className="inline-block rounded-full border border-line bg-ink2 px-3 py-1 text-xs font-medium text-fog transition-colors hover:text-snow"
            >
              {category.name}
            </Link>
          )}
          <h1 className="mt-2.5 font-display text-3xl font-bold sm:text-4xl">{product.name}</h1>

          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold text-gold">
              {formatINR(product.price)}
            </span>
            {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
              <span className="text-lg text-fog line-through">
                {formatINR(product.compareAtPrice)}
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

              <ProductPurchase product={product} />
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

          {product.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/browse?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-panel px-3 py-1 text-xs text-fog transition-colors hover:text-snow"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-12 -mx-4 sm:-mx-8">
          <Row
            title="More like this"
            href={category ? `/browse?category=${category.slug}` : "/browse"}
          >
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Row>
        </div>
      )}
    </>
  );
}
