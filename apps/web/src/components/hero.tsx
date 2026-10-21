"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Droplets, Sparkles, Sun } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import { FREE_SHIPPING_THRESHOLD, discountPercent, formatINR } from "@stickypie/shared";
import { tileFor } from "@/lib/palette";
import AddToCartButton from "./add-to-cart-button";

/** Rotating hero: the featured sticker is staged on a big tilted product card. */
export default function Hero({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const picks = products.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const product = picks[Math.min(index, picks.length - 1)];

  useEffect(() => {
    if (picks.length < 2 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % picks.length), 6500);
    return () => clearInterval(timer);
  }, [picks.length, paused]);

  if (!product) return null;

  const tile = tileFor(product.slug);
  const off = discountPercent(product.price, product.compareAtPrice);
  const categoryName = categories.find((c) => c.id === product.categoryId)?.name;

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex items-center overflow-x-clip lg:min-h-[70svh]"
    >
      {/* Layered background */}
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(75%_65%_at_50%_38%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-44 -left-44 size-[36rem] rounded-full bg-brand/15 blur-[130px]" />
      <div
        className="pointer-events-none absolute top-1/3 -right-44 size-[32rem] rounded-full blur-[140px] transition-colors duration-700"
        style={{ background: `${tile.glow}1f` }}
      />

      <div className="relative grid w-full items-center gap-5 px-4 pt-20 pb-8 sm:gap-8 sm:px-8 sm:pt-24 lg:grid-cols-[1fr_1.2fr] lg:gap-14 lg:px-12 lg:pt-24 lg:pb-10 2xl:px-20">
        {/* Copy */}
        <div key={product.id} className="animate-hero-in order-2 max-w-2xl lg:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
              <Sparkles className="size-3.5" /> Featured drop
            </span>
            {categoryName && (
              <span className="hidden rounded-full border border-line bg-ink2 px-3.5 py-1.5 text-[11px] font-semibold tracking-widest text-fog uppercase sm:inline-block">
                {categoryName}
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl leading-[1.04] font-bold tracking-tight sm:text-6xl lg:mt-5 lg:text-[64px]">
            {product.name}
          </h1>
          <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg lg:line-clamp-3">
            {product.description}
          </p>

          <div className="mt-3 flex items-baseline gap-3 sm:mt-6">
            <span className="font-display text-4xl font-bold text-gold">
              {formatINR(product.price)}
            </span>
            {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
              <>
                <span className="text-lg text-fog/80 line-through">
                  {formatINR(product.compareAtPrice)}
                </span>
                {off !== null && (
                  <span className="rounded-full border border-mint/30 bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint">
                    SAVE {off}%
                  </span>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-8">
            <AddToCartButton product={product} size="lg" />
            <Link
              href={`/sticker/${product.slug}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-ink2 px-6 text-base font-semibold transition-all hover:border-fog/40 hover:bg-panel"
            >
              Details <ArrowRight className="size-4" />
            </Link>
          </div>

          <ul className="mt-8 hidden flex-wrap gap-2 text-[11px] font-semibold tracking-wide text-fog sm:flex">
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <Droplets className="size-3.5 text-mint" /> Waterproof vinyl
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <BadgeCheck className="size-3.5 text-mint" /> Die-cut edges
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <Sun className="size-3.5 text-mint" /> UV &amp; fade safe
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              Free shipping over {formatINR(FREE_SHIPPING_THRESHOLD)}
            </li>
          </ul>
        </div>

        {/* Artwork, merged into the hero background (no frame) */}
        <div className="relative order-1 mx-auto w-full max-w-[340px] sm:max-w-xl lg:order-2 lg:mx-0 lg:max-w-none">
          {/* product-tinted wash behind the art */}
          <div
            className="pointer-events-none absolute inset-0 m-auto aspect-square w-[105%] rounded-full blur-[85px] transition-colors duration-700"
            style={{ background: `${tile.glow}30` }}
          />
          <div className="pointer-events-none absolute inset-0 m-auto aspect-square w-[55%] rounded-full bg-white/70 blur-[60px]" />

          <div key={product.id} className="animate-hero-img-in relative aspect-[5/4] overflow-hidden lg:aspect-auto lg:h-[min(50vh,560px)]">
            <div className="absolute inset-0 grid place-items-center p-2 sm:p-4 lg:px-6 lg:pt-0 lg:pb-5">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="animate-float max-h-full max-w-full rotate-2 object-contain lg:max-h-[min(46vh,520px)]"
              />
            </div>

          </div>

          {/* Slide indicator */}
          {picks.length > 1 && (
            <div className="relative z-10 mt-4 flex justify-center gap-2 lg:mt-7">
              {picks.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Show ${p.name}`}
                  onClick={() => setIndex(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === index
                      ? "pie-gradient w-9 shadow-sm shadow-brand/40"
                      : "w-2.5 bg-snow/15 hover:bg-snow/35"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
