"use client";

import SmartImg from "./smart-img";
import HoverLink from "./hover-link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Droplets,
  ImageUp,
  Ruler,
  Scissors,
  Shapes,
  Sparkles,
  Sun,
  Truck,
} from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import {
  customSizes,
  discountPercent,
  formatINR,
  formatInches,
} from "@stickypie/shared";
import { cardSkinFor, tileFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import AddToCartButton from "./add-to-cart-button";
import { useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";

/** Rotating hero: the featured sticker is staged on a big tilted product card. */
export default function Hero({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const picks = products.slice(0, 5);
  const features = useFeatures();
  const settings = useStoreSettings();
  const custom = features.customStickers
    ? customSizes(settings.customPrices)
    : [];
  // Second slide (when on): print your own design.
  const slides: Slide[] =
    custom.length > 0 && picks.length > 0
      ? [
          { kind: "product", product: picks[0] },
          { kind: "custom" },
          ...picks
            .slice(1)
            .map((p) => ({ kind: "product" as const, product: p })),
        ]
      : picks.map((p) => ({ kind: "product" as const, product: p }));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const seed = useSkinSeed();
  // Shopper picked a size → stop rotating so the slide doesn't change under them.
  const [engaged, setEngaged] = useState(false);
  const slide = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    if (slides.length < 2 || paused || engaged) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      6500,
    );
    return () => clearInterval(timer);
    // index: a swipe or dot tap restarts the wait for the next slide.
  }, [slides.length, paused, engaged, index]);

  // Swipe left / right on phones to change slide.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length);

  if (!slide) return null;
  const product = slide.kind === "product" ? slide.product : null;
  const key = product ? product.id : "custom";
  const skinSlug = product ? product.slug : "custom-stickers";

  const tile = tileFor(skinSlug);
  // Each slide sits on a sticker sheet or cutting mat — a new mix every load.
  const skin = cardSkinFor(skinSlug, seed);

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start || slides.length < 2) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // A clear sideways swipe, not a scroll or a tap.
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}
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
        {/* Copy: every slide is laid out in the same cell, so the hero keeps the
            height of the tallest slide and never jumps as slides change. */}
        <div className="order-2 grid max-w-2xl lg:order-1">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.kind === "product" ? s.product.id : "custom"}
                aria-hidden={!active}
                inert={!active}
                className={`col-start-1 row-start-1 self-end ${active ? "animate-hero-in" : "pointer-events-none invisible"}`}
              >
                {s.kind === "product" ? (
                  <ProductSlideCopy
                    product={s.product}
                    categoryName={categories.find((c) => c.id === s.product.categoryId)?.name}
                    onPickSize={() => setEngaged(true)}
                  />
                ) : (
                  <CustomSlideCopy sizes={custom} />
                )}
              </div>
            );
          })}

          <ul className="col-start-1 row-start-2 mt-8 hidden flex-wrap gap-2 text-[11px] font-semibold tracking-wide text-fog sm:flex">
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

          <div key={key} className="animate-hero-img-in relative aspect-[5/4] lg:aspect-auto lg:h-[min(50vh,560px)]">
            {product ? (
              <div className="absolute inset-0 grid place-items-center p-2 sm:p-4 lg:px-6 lg:pt-0 lg:pb-5">
                <SmartImg
                  full={product.imageUrl}
                  thumb={product.thumbUrl}
                  alt={product.name}
                  priority
                  className="sticker-cut animate-float max-h-full max-w-full rotate-2 object-contain lg:max-h-[min(46vh,520px)]"
                />
              </div>
            ) : (
              <CustomSlideArt sizes={custom} />
            )}
          </div>

          {/* Slide indicator */}
          {slides.length > 1 && (
            <div className="relative z-10 mt-4 flex items-center justify-center gap-2 lg:mt-7">
              {slides.map((s, i) => (
                <button
                  key={s.kind === "product" ? s.product.id : "custom"}
                  type="button"
                  aria-label={
                    s.kind === "product"
                      ? `Show ${s.product.name}`
                      : "Show custom stickers"
                  }
                  onClick={() => setIndex(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === index
                      ? "pie-gradient w-9 shadow-sm shadow-brand/40"
                      : s.kind === "custom"
                        ? "w-2.5 border-[1.5px] border-dashed border-brand hover:bg-brand/20"
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

type Slide = { kind: "product"; product: Product } | { kind: "custom" };

/** A sticker slide's text: badges, name, description, price and buy controls. */
function ProductSlideCopy({
  product,
  categoryName,
  onPickSize,
}: {
  product: Product;
  categoryName: string | undefined;
  onPickSize: () => void;
}) {
  return (
    <>
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
      <h2 className="mt-4 line-clamp-2 font-display text-4xl leading-[1.04] font-bold tracking-tight sm:text-6xl lg:mt-5 lg:text-[64px]">
        {product.name}
      </h2>
      <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg lg:line-clamp-3">
        {product.description}
      </p>
      <HeroBuy product={product} onPickSize={onPickSize} />
    </>
  );
}

/**
 * The custom slide's picture: a blank die-cut sticker "in the making" — cut
 * line with scissors, a peeling corner, a second copy behind and a few
 * floating labels. Pure shapes and icons (no sticker artwork).
 */
function CustomSlideArt({ sizes }: { sizes: { inches: number }[] }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative aspect-square h-[74%] max-h-[380px]">
        {/* second copy peeking out behind */}
        <div className="absolute inset-0 translate-x-[9%] translate-y-[5%] rotate-[9deg] rounded-[36px] bg-white/70 shadow-lg ring-1 ring-black/5" />

        <div className="animate-float absolute inset-0">
          {/* plotter cut line */}
          <div className="absolute -inset-[7%] rounded-[46px] border-2 border-dashed border-brand/60" />
          <span className="absolute top-[-7%] left-[18%] grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white text-brand shadow-md ring-1 ring-brand/20">
            <Scissors className="size-4 -rotate-90" />
          </span>

          {/* the sticker: white die-cut border around a soft artwork area */}
          <div className="relative size-full overflow-hidden rounded-[36px] bg-white p-[6%] shadow-[0_24px_50px_-20px_rgba(16,24,40,0.45)]">
            <div className="grid size-full place-items-center rounded-[26px] bg-[radial-gradient(circle_at_30%_25%,rgba(255,122,60,0.18),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(255,46,99,0.16),transparent_55%)] text-center">
              <span>
                <span className="pie-gradient mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-brand/30 lg:size-16">
                  <ImageUp className="size-7 lg:size-8" />
                </span>
                <span className="mt-3 block font-display text-2xl font-bold text-snow lg:text-3xl">Your design</span>
                <span className="mt-0.5 block text-xs font-semibold tracking-wide text-fog uppercase">logo · photo · art</span>
              </span>
            </div>
            {/* peeling corner */}
            <span className="absolute right-0 bottom-0 size-[22%] bg-[linear-gradient(135deg,transparent_50%,#e9ecf2_50%,#ffffff_78%)] shadow-[-4px_-4px_10px_-6px_rgba(16,24,40,0.35)]" />
          </div>
        </div>

        {/* floating labels */}
        <span className="animate-float-slow absolute top-[6%] -left-[14%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-snow shadow-md">
          <Shapes className="size-3.5 text-brand" /> Any shape
        </span>
        <span className="animate-float-slow absolute top-[42%] -right-[16%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-snow shadow-md [animation-delay:-4s]">
          <Ruler className="size-3.5 text-brand" /> {sizes.length > 3 ? `${formatInches(sizes[0].inches)}″ – ${formatInches(sizes[sizes.length - 1].inches)}″` : sizes.map((s) => `${formatInches(s.inches)}″`).join(" · ")}
        </span>
        <span className="animate-float-slow absolute bottom-[2%] -left-[8%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-snow shadow-md [animation-delay:-7s]">
          <Droplets className="size-3.5 text-mint" /> Waterproof vinyl
        </span>
      </div>
    </div>
  );
}

/** Custom sticker slide: copy, prices per size and the call to action. */
function CustomSlideCopy({ sizes }: { sizes: { inches: number; price: number }[] }) {
  const from = Math.min(...sizes.map((s) => s.price));
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
        <ImageUp className="size-3.5" /> Custom print
      </span>
      <h2 className="mt-4 line-clamp-2 font-display text-4xl leading-[1.04] font-bold tracking-tight sm:text-6xl lg:mt-5 lg:text-[64px]">
        Your design, as a sticker
      </h2>
      <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg lg:line-clamp-3">
        Logo, photo or artwork on waterproof die-cut vinyl. Pick a size and quantity, book, and send your
        design — now or after paying.
      </p>
      <div className="mt-3 flex items-baseline gap-2 sm:mt-6">
        <span className="text-sm text-fog">from</span>
        <span className="font-display text-4xl font-bold text-gold">{formatINR(from)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sizes.map((s) => (
          <span
            key={s.inches}
            className="inline-flex items-baseline gap-1.5 rounded-xl border border-line bg-ink2/80 px-3.5 py-2 backdrop-blur-sm"
          >
            <span className="font-display text-base font-bold">{formatInches(s.inches)}″</span>
            <span className="text-xs font-semibold text-fog">{formatINR(s.price)}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
        <HoverLink
          href="/custom-stickers"
          className="peel-btn inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-bold"
        >
          Make your sticker <ArrowRight className="size-4" />
        </HoverLink>
        <HoverLink
          href="/custom-stickers"
          className="inline-flex h-12 items-center px-2 text-sm font-semibold text-fog transition-colors hover:text-brand"
        >
          Bulk or special requests
        </HoverLink>
      </div>
    </>
  );
}

/** Price, size choice and add-to-cart for the slide's sticker. */
function HeroBuy({
  product,
  onPickSize,
}: {
  product: Product;
  onPickSize: () => void;
}) {
  const { sizes, size, setSize, price, compareAtPrice } =
    useSizeChoice(product);
  const off = discountPercent(price, compareAtPrice);
  const [trueSize, setTrueSize] = useState(false);
  const features = useFeatures();

  return (
    <>
      <div className="mt-3 flex items-baseline gap-3 sm:mt-6">
        <span className="font-display text-4xl font-bold text-gold">
          {formatINR(price)}
        </span>
        {compareAtPrice !== null && compareAtPrice > price && (
          <>
            <span className="text-lg text-fog/80 line-through">
              {formatINR(compareAtPrice)}
            </span>
            {off !== null && (
              <span className="rounded-full border border-mint/30 bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint">
                SAVE {off}%
              </span>
            )}
          </>
        )}
      </div>

      {sizes.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Sticker size"
          className="mt-4 flex flex-wrap gap-2"
        >
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
                <span className="font-display text-base font-bold">
                  {formatInches(s.inches)}″
                </span>
                <span
                  className={`text-xs font-semibold ${active ? "text-brand" : "text-fog"}`}
                >
                  {formatINR(s.price)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
        <AddToCartButton
          product={product}
          stickerSize={size}
          size="lg"
          sticker
        />
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
      {features.customStickers && (
        <HoverLink
          href="/custom-stickers"
          className="group mt-4 inline-flex items-center gap-2.5 rounded-2xl border border-dashed border-brand/40 bg-ink2/80 px-4 py-2.5 text-sm backdrop-blur-sm transition-colors hover:border-brand sm:mt-5"
        >
          <ImageUp className="size-4.5 text-brand" />
          <span>
            <span className="font-semibold text-snow">Got your own design?</span>{" "}
            <span className="text-fog">Make your own sticker</span>
          </span>
          <ArrowRight className="size-4 text-brand transition-transform group-hover:translate-x-0.5" />
        </HoverLink>
      )}
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
