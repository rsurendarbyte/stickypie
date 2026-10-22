"use client";

import SmartImg from "./smart-img";
import HoverLink from "./hover-link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Droplets, Ruler, Sparkles, Sun, Truck } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import { discountPercent, formatINR, formatInches } from "@stickypie/shared";
import { cardSkinFor, tileFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import AddToCartButton from "./add-to-cart-button";
import { useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";

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
  const seed = useSkinSeed();
  // Shopper picked a size → stop rotating so the slide doesn't change under them.
  const [engaged, setEngaged] = useState(false);
  const product = picks[Math.min(index, picks.length - 1)];

  useEffect(() => {
    if (picks.length < 2 || paused || engaged) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % picks.length), 6500);
    return () => clearInterval(timer);
  }, [picks.length, paused, engaged]);

  if (!product) return null;

  const tile = tileFor(product.slug);
  // Each slide sits on a sticker sheet or cutting mat — a new mix every load.
  const skin = cardSkinFor(product.slug, seed);
  const categoryName = categories.find((c) => c.id === product.categoryId)?.name;

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex items-center overflow-x-clip lg:min-h-[70svh]"
    >
      {/* Background: the slide's sticker sheet / cutting mat fills the hero and
          fades softly into the page below (no hard edge). */}
      <div
        aria-hidden
        style={skin.art}
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-700 [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]"
      />
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

          {/* The page's H1 is in the shop intro below; a rotating product isn't the page topic. */}
          <h2 className="mt-4 font-display text-4xl leading-[1.04] font-bold tracking-tight sm:text-6xl lg:mt-5 lg:text-[64px]">
            {product.name}
          </h2>
          <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg lg:line-clamp-3">
            {product.description}
          </p>

          <HeroBuy key={product.id} product={product} onPickSize={() => setEngaged(true)} />

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
              <Truck className="size-3.5 text-mint" /> Ships across India
            </li>
          </ul>
        </div>

        {/* Artwork, floating on the mat */}
        <div className="relative order-1 mx-auto w-full max-w-[340px] sm:max-w-xl lg:order-2 lg:mx-0 lg:max-w-none">
          {/* product-tinted wash behind the art */}
          <div
            className="pointer-events-none absolute inset-0 m-auto aspect-square w-[105%] rounded-full blur-[85px] transition-colors duration-700"
            style={{ background: `${tile.glow}30` }}
          />
          <div className="pointer-events-none absolute inset-0 m-auto aspect-square w-[55%] rounded-full bg-white/70 blur-[60px]" />

          <div key={product.id} className="animate-hero-img-in relative aspect-[5/4] lg:aspect-auto lg:h-[min(50vh,560px)]">
            <div className="absolute inset-0 grid place-items-center p-2 sm:p-4 lg:px-6 lg:pt-0 lg:pb-5">
              <SmartImg
                full={product.imageUrl}
                thumb={product.thumbUrl}
                alt={product.name}
                priority
                className="sticker-cut animate-float max-h-full max-w-full rotate-2 object-contain lg:max-h-[min(46vh,520px)]"
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

/** Price, size choice and add-to-cart for the slide's sticker. */
function HeroBuy({ product, onPickSize }: { product: Product; onPickSize: () => void }) {
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product);
  const off = discountPercent(price, compareAtPrice);
  const [trueSize, setTrueSize] = useState(false);

  return (
    <>
      <div className="mt-3 flex items-baseline gap-3 sm:mt-6">
        <span className="font-display text-4xl font-bold text-gold">{formatINR(price)}</span>
        {compareAtPrice !== null && compareAtPrice > price && (
          <>
            <span className="text-lg text-fog/80 line-through">{formatINR(compareAtPrice)}</span>
            {off !== null && (
              <span className="rounded-full border border-mint/30 bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint">
                SAVE {off}%
              </span>
            )}
          </>
        )}
      </div>

      {sizes.length > 1 && (
        <div role="radiogroup" aria-label="Sticker size" className="mt-4 flex flex-wrap gap-2">
          {sizes.map((s) => {
            const active = s.inches === size;
            return (
              <button
                key={s.inches}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSize(s.inches);
                  onPickSize();
                }}
                className={`inline-flex items-baseline gap-1.5 rounded-xl border px-3.5 py-2 transition-all ${
                  active
                    ? "border-brand bg-brand/[0.07] ring-1 ring-brand"
                    : "border-line bg-ink2/80 backdrop-blur-sm hover:border-snow/30"
                }`}
              >
                <span className="font-display text-base font-bold">{formatInches(s.inches)}″</span>
                <span className={`text-xs font-semibold ${active ? "text-brand" : "text-fog"}`}>
                  {formatINR(s.price)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
        <AddToCartButton product={product} stickerSize={size} size="lg" sticker />
        <HoverLink
          href={`/sticker/${product.slug}`}
          className="peel-btn peel-btn--light inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-bold"
        >
          Details <ArrowRight className="size-4" />
        </HoverLink>
        {sizes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setTrueSize(true);
              onPickSize();
            }}
            className="inline-flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fog transition-colors hover:text-brand"
          >
            <Ruler className="size-4" /> Actual size
          </button>
        )}
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
          onSizeChange={(inches) => {
            setSize(inches);
            onPickSize();
          }}
        />
      )}
    </>
  );
}
