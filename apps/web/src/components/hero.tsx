"use client";

import Link from "@/components/page-link";
import SmartImg from "./smart-img";
import PageLink from "./page-link";
import { isMiniPoster } from "@/lib/poster";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Car,
  ImageUp,
  Link2,
  MessageCircle,
  QrCode,
  Ruler,
  Scissors,
  Shapes,
  Sparkles,
  Sticker,
  Truck,
  Wallet,
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
import {
  useFeatures,
  useLiveCatalog,
  useStoreSettings,
} from "@/lib/live-catalog";
import { drawSticker } from "@/lib/qr-art";

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
  const qr = features.customStickers ? customSizes(settings.qrPrices) : [];
  // Sticker slides, with "your own design" second and "QR code sticker" fourth (when on).
  const slides: Slide[] = picks.map((p) => ({
    kind: "product" as const,
    product: p,
  }));
  if (picks.length > 0 && custom.length > 0)
    slides.splice(1, 0, { kind: "custom" });
  if (picks.length > 0 && qr.length > 0)
    slides.splice(Math.min(3, slides.length), 0, { kind: "qr" });
  // StickyPie itself always opens the hero: what we are + a nudge to order.
  if (picks.length > 0) slides.unshift({ kind: "brand" });
  const { products: catalog } = useLiveCatalog({
    categories: [],
    products: [],
  });
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
  const go = (step: number) =>
    setIndex((i) => (i + step + slides.length) % slides.length);

  if (!slide) return null;
  const product = slide.kind === "product" ? slide.product : null;
  const key = product ? product.id : slide.kind;
  const skinSlug = product
    ? product.slug
    : slide.kind === "qr"
      ? "qr-code-stickers"
      : slide.kind === "brand"
        ? "stickypie"
        : "custom-stickers";

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
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
          go(dx < 0 ? 1 : -1);
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
      {slide.kind === "brand" && (
        <>
          <BrandSlideArt
            key="wall"
            stickers={wallItems(catalog.length ? catalog : products, features.wallPostersOnly)}
          />
          {/* white wash behind the words: from below on phones, from the left on desktop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.9)_42%,rgba(255,255,255,0.15)_75%,transparent_100%)] lg:bg-[linear-gradient(to_right,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.88)_34%,rgba(255,255,255,0.2)_58%,transparent_75%)]"
          />
        </>
      )}
      <div
        className="pointer-events-none absolute top-1/3 -right-44 size-[32rem] rounded-full blur-[140px] transition-colors duration-700"
        style={{ background: `${tile.glow}1f` }}
      />

      <div
        className={`relative grid w-full items-center gap-3 px-4 pt-[68px] pb-5 sm:gap-8 sm:px-8 sm:pt-24 lg:grid-cols-[1fr_1.2fr] lg:gap-14 lg:px-12 lg:pt-24 lg:pb-10 2xl:px-20 ${slide.kind === "brand" ? "pointer-events-none" : ""}`}
      >
        {/* Copy: every slide is laid out in the same cell, so the hero keeps the
            height of the tallest slide and never jumps as slides change. */}
        {/* z-10: on phones the sticker can reach down behind the text — it stays a backdrop */}
        <div className="pointer-events-auto relative z-10 order-2 grid max-w-2xl lg:order-1">
          {/* Phones: a soft frosted fade behind the text, so the picture above
              melts away under it instead of clashing with the badge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -top-14 -bottom-5 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_22%,rgba(255,255,255,0.86)_55%,rgba(255,255,255,0.9)_100%)] backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,transparent_0%,black_26%)] sm:hidden"
          />
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.kind === "product" ? s.product.id : s.kind}
                aria-hidden={!active}
                inert={!active}
                className={`col-start-1 row-start-1 self-end ${active ? "animate-hero-in" : "pointer-events-none invisible"}`}
              >
                {s.kind === "product" ? (
                  <ProductSlideCopy
                    product={s.product}
                    categoryName={
                      categories.find((c) => c.id === s.product.categoryId)
                        ?.name
                    }
                    onPickSize={() => setEngaged(true)}
                  />
                ) : s.kind === "brand" ? (
                  <BrandSlideCopy
                    catalog={catalog.length ? catalog : products}
                  />
                ) : (
                  <CustomSlideCopy
                    kind={s.kind}
                    sizes={s.kind === "qr" ? qr : custom}
                  />
                )}
              </div>
            );
          })}

          {slides.length > 1 && (
            <div className="col-start-1 row-start-2 mt-4 flex items-center justify-center gap-2 sm:hidden">
              {slides.map((s, i) => (
                <button
                  key={s.kind === "product" ? s.product.id : s.kind}
                  type="button"
                  aria-label={`Show slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index
                      ? "pie-gradient w-7 shadow-sm shadow-brand/40"
                      : s.kind !== "product"
                        ? "w-2 border-[1.5px] border-dashed border-brand"
                        : "w-2 bg-snow/20"
                  }`}
                />
              ))}
            </div>
          )}
          <ul className="col-start-1 row-start-2 mt-8 hidden flex-wrap gap-2 text-[11px] font-semibold tracking-wide text-fog sm:flex">
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <Sticker className="size-3.5 text-mint" /> Peel &amp; stick
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <BadgeCheck className="size-3.5 text-mint" /> Die-cut edges
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <Car className="size-3.5 text-mint" /> Car, bike &amp; laptop
            </li>
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
              <Truck className="size-3.5 text-mint" /> Ships across India
            </li>
          </ul>
        </div>

        {/* Artwork, floating on the mat */}
        <div
          className={`relative z-0 order-1 mx-auto w-full max-w-[340px] sm:max-w-xl lg:order-2 ${slide.kind === "brand" ? "pointer-events-none [&_button]:pointer-events-auto" : ""} lg:mx-0 lg:max-w-none`}
        >
          {/* product-tinted wash behind the art */}
          {slide.kind !== "brand" && (
            <>
              <div
                className="pointer-events-none absolute inset-0 m-auto aspect-square w-[105%] rounded-full blur-[85px] transition-colors duration-700"
                style={{ background: `${tile.glow}30` }}
              />
              <div className="pointer-events-none absolute inset-0 m-auto aspect-square w-[55%] rounded-full bg-white/70 blur-[60px]" />
            </>
          )}

          <div
            key={key}
            className="animate-hero-img-in relative aspect-[16/10] sm:aspect-[5/4] lg:aspect-auto lg:h-[min(50vh,560px)]"
          >
            {product ? (
              <div
                // one fixed-size cell, so max-h-full has a height to fit tall art (posters) into
                className="absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center p-2 sm:p-4 lg:px-6 lg:pt-0 lg:pb-5"
              >
                <SmartImg
                  full={product.imageUrl}
                  thumb={product.thumbUrl}
                  alt={product.name}
                  priority
                  className="sticker-cut animate-float max-h-full max-w-full rotate-2 object-contain lg:max-h-[min(46vh,520px)]"
                />
              </div>
            ) : slide.kind === "brand" ? null : slide.kind === "qr" ? (
              <QrSlideArt />
            ) : (
              <CustomSlideArt sizes={custom} />
            )}
          </div>

          {/* Slide indicator */}
          {slides.length > 1 && (
            <div className="relative z-10 mt-4 hidden items-center justify-center gap-2 sm:flex lg:mt-7">
              {slides.map((s, i) => (
                <button
                  key={s.kind === "product" ? s.product.id : s.kind}
                  type="button"
                  aria-label={
                    s.kind === "product"
                      ? `Show ${s.product.name}`
                      : s.kind === "qr"
                        ? "Show QR code stickers"
                        : s.kind === "brand"
                          ? "Show StickyPie"
                          : "Show custom stickers"
                  }
                  onClick={() => setIndex(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === index
                      ? "pie-gradient w-9 shadow-sm shadow-brand/40"
                      : s.kind !== "product"
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

type Slide =
  | { kind: "product"; product: Product }
  | { kind: "brand" }
  | { kind: "custom" }
  | { kind: "qr" };

/** First slide: StickyPie in one line, a few quick facts, and two ways to order. */
function BrandSlideCopy({ catalog }: { catalog: Product[] }) {
  const from = catalog.length ? Math.min(...catalog.map((p) => p.price)) : null;
  // Rounded down to a friendly "100+" style number.
  const count =
    catalog.length >= 20
      ? `${Math.floor(catalog.length / 10) * 10}+`
      : `${catalog.length}`;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
        <Sparkles className="size-3.5" /> StickyPie stickers
      </span>
      <h2 className="mt-2.5 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl lg:mt-5 lg:text-[64px]">
        Stick your style.
      </h2>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-fog sm:mt-4 sm:text-lg">
        Die-cut vinyl stickers for your car, bike, laptop and bottle.
      </p>
      {catalog.length > 0 && (
        <p className="mt-3 text-sm font-semibold text-snow sm:mt-5">
          {count} designs
          {from !== null && (
            <>
              {" "}
              · from{" "}
              <span className="font-display text-gold">{formatINR(from)}</span>
            </>
          )}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
        <PageLink
          href="/stickers"
          className="peel-btn inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold sm:h-12 sm:px-6 sm:text-base"
        >
          Shop stickers <ArrowRight className="size-4" />
        </PageLink>
        <PageLink
          href="/custom-stickers"
          className="peel-btn peel-btn--light inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold sm:h-12 sm:px-5"
        >
          <ImageUp className="size-4" /> Make your own
        </PageLink>
      </div>
    </>
  );
}

/** What the banner wall shows: only mini posters when admin → Features says so
 *  (falls back to everything while there are none), otherwise all of it. */
function wallItems(all: Product[], postersOnly: boolean) {
  const posters = postersOnly ? all.filter(isMiniPoster) : [];
  return (posters.length ? posters : all).slice(0, 30);
}

/**
 * First slide's backdrop: a wall of real stickers filling the whole hero —
 * columns scrolling up and down (alternating), tilted diagonally, fading out
 * at the top and bottom. Tiles size with the screen, so it fills any device.
 * Each sticker opens its page; the wall keeps moving the whole time.
 */
function BrandSlideArt({ stickers }: { stickers: Product[] }) {
  const COLS = 10;
  const PER_COL = 7;
  const pool = stickers;
  if (!pool.length) return null;
  const columns = Array.from({ length: COLS }, (_, c) =>
    Array.from(
      { length: PER_COL },
      (_, k) => pool[(c * 7 + k * 4) % pool.length],
    ),
  );
  return (
    <div className="sticker-wall animate-hero-img-in absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] gap-3 sm:gap-4">
        {columns.map((col, c) => (
          // Phones only see the middle columns of the tilted wall, so the outer
          // four aren't drawn there (display:none — no images, no animation work).
          <div key={c} className={`w-[clamp(92px,13vw,170px)] shrink-0 ${c < 2 || c > 7 ? "max-sm:hidden" : ""}`}>
            {/* three copies stacked: the column scrolls by one copy and loops
                without a seam, and the screen never reaches either end */}
            <div
              className={`flex flex-col gap-3 sm:gap-4 ${c % 2 ? "sticker-wall-down" : "sticker-wall-up"}`}
              style={{ animationDuration: `${44 + (c % 4) * 7}s` }}
            >
              {[...col, ...col, ...col].map((p, k) => {
                // Every tile peels its corner now and then: its own cycle length and
                // starting point (fixed per tile, so server and browser agree).
                const n = c * 31 + k * 17;
                const peel = {
                  "--peel-cycle": `${8 + (n % 9)}s`,
                  "--peel-delay": `${-((n * 7) % 13)}s`,
                } as React.CSSProperties;
                // A mini poster is a rectangle, not a die-cut: it is the tile itself —
                // no white tile around it — with a white sticker edge, trimmed to 4:5
                // on the wall only.
                const poster = isMiniPoster(p);
                return (
                  <Link
                    key={`${p.id}-${k}`}
                    href={`/sticker/${p.slug}`}
                    tabIndex={-1}
                    aria-label={p.name}
                    style={peel}
                    className={`wall-tile grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center transition-transform duration-200 hover:scale-[1.06] ${
                      poster
                        ? "aspect-[4/5]"
                        : "aspect-square rounded-2xl bg-white/85 p-[11%] shadow-[0_10px_24px_-14px_rgba(16,24,40,0.35)] ring-1 ring-black/5 hover:ring-brand/40"
                    }`}
                  >
                    {poster ? (
                      // same peel as the stickers, with the fold measured from the
                      // poster's width so it lifts a neat corner on a rectangle
                      <span
                        className="wall-peel wall-peel-poster relative size-full"
                      >
                        <img
                          src={p.thumbUrl ?? p.imageUrl}
                          alt=""
                          loading="lazy"
                          className="wall-peel-front wall-poster absolute inset-0 size-full object-cover"
                        />
                        <span aria-hidden className="wall-peel-shadow absolute inset-0">
                          <img
                            src={p.thumbUrl ?? p.imageUrl}
                            alt=""
                            loading="lazy"
                            className="wall-peel-flap wall-poster absolute inset-0 size-full object-cover"
                          />
                        </span>
                      </span>
                    ) : (
                      // the sticker, and a white copy of it folded back over the
                      // peeling corner as its backing paper (see .wall-peel)
                      <span className="wall-peel relative size-full">
                        <img
                          src={p.thumbUrl ?? p.imageUrl}
                          alt=""
                          loading="lazy"
                          className="wall-peel-front absolute inset-0 size-full object-contain"
                        />
                        <span aria-hidden className="wall-peel-shadow absolute inset-0">
                          <img
                            src={p.thumbUrl ?? p.imageUrl}
                            alt=""
                            loading="lazy"
                            className="wall-peel-flap absolute inset-0 size-full object-contain"
                          />
                        </span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** QR slide picture: a real QR sticker (pointing at our QR page), drawn on the device. */
function QrSlideArt() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSrc(
        drawSticker(
          "https://stickypie.in/qr-code-stickers",
          "Scan to pay",
          520,
        ).toDataURL("image/png"),
      );
    } catch {
      setSrc(null);
    }
  }, []);
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative h-[74%] max-h-[380px]">
        {src && (
          <img
            src={src}
            alt=""
            className="sticker-cut animate-float h-full w-auto -rotate-3 rounded-[28px] object-contain"
          />
        )}
        <span className="animate-float-slow absolute top-[8%] -left-[22%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-snow shadow-md">
          <Wallet className="size-3.5 text-brand" /> UPI payments
        </span>
        <span className="animate-float-slow absolute top-[45%] -right-[26%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-snow shadow-md [animation-delay:-4s]">
          <MessageCircle className="size-3.5 text-mint" /> WhatsApp
        </span>
        <span className="animate-float-slow absolute bottom-[4%] -left-[18%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-snow shadow-md [animation-delay:-7s]">
          <Link2 className="size-3.5 text-brand" /> Website &amp; Instagram
        </span>
      </div>
    </div>
  );
}

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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white/90 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase shadow-sm backdrop-blur-sm">
          <Sparkles className="size-3.5" /> Featured drop
        </span>
        {categoryName && (
          <span className="hidden rounded-full border border-line bg-ink2 px-3.5 py-1.5 text-[11px] font-semibold tracking-widest text-fog uppercase sm:inline-block">
            {categoryName}
          </span>
        )}
      </div>
      {/* The page's H1 is in the shop intro below; a rotating product isn't the page topic. */}
      <h2 className="mt-2.5 line-clamp-2 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl lg:mt-5 lg:text-[64px]">
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
                <span className="mt-3 block font-display text-2xl font-bold text-snow lg:text-3xl">
                  Your design
                </span>
                <span className="mt-0.5 block text-xs font-semibold tracking-wide text-fog uppercase">
                  logo · photo · art
                </span>
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
          <Ruler className="size-3.5 text-brand" />{" "}
          {sizes.length > 3
            ? `${formatInches(sizes[0].inches)}″ – ${formatInches(sizes[sizes.length - 1].inches)}″`
            : sizes.map((s) => `${formatInches(s.inches)}″`).join(" · ")}
        </span>
        <span className="animate-float-slow absolute bottom-[2%] -left-[8%] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-snow shadow-md [animation-delay:-7s]">
          <Scissors className="size-3.5 text-mint" /> Clean die-cut
        </span>
      </div>
    </div>
  );
}

const SPECIAL_SLIDES = {
  custom: {
    icon: ImageUp,
    badge: "Custom print",
    title: "Your design, as a sticker",
    text: "Logo, photo or artwork on waterproof die-cut vinyl. Pick a size and quantity, book, and send your design — now or after paying.",
    href: "/custom-stickers/design",
    cta: "Make your sticker",
  },
  qr: {
    icon: QrCode,
    badge: "QR stickers",
    title: "Scan-to-pay QR stickers",
    text: "Your UPI, WhatsApp, Instagram or website as a QR sticker with a label like “Scan to pay”. Made in a minute, printed on waterproof vinyl.",
    href: "/qr-code-stickers",
    cta: "Make your QR sticker",
  },
} as const;

/** Custom / QR slide: copy, prices per size and the call to action. */
function CustomSlideCopy({
  kind,
  sizes,
}: {
  kind: keyof typeof SPECIAL_SLIDES;
  sizes: { inches: number; price: number }[];
}) {
  const c = SPECIAL_SLIDES[kind];
  const Icon = c.icon;
  const from = Math.min(...sizes.map((s) => s.price));
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
        <Icon className="size-3.5" /> {c.badge}
      </span>
      <h2 className="mt-2.5 line-clamp-2 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl lg:mt-5 lg:text-[64px]">
        {c.title}
      </h2>
      <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg lg:line-clamp-3">
        {c.text}
      </p>
      <div className="mt-2 flex items-baseline gap-2 sm:mt-6">
        <span className="text-sm text-fog">from</span>
        <span className="font-display text-3xl font-bold text-gold sm:text-4xl">
          {formatINR(from)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
        {sizes.map((s) => (
          <span
            key={s.inches}
            className="inline-flex items-baseline gap-1.5 rounded-xl border border-line bg-ink2/80 px-3.5 py-2 backdrop-blur-sm"
          >
            <span className="font-display text-base font-bold">
              {formatInches(s.inches)}″
            </span>
            <span className="text-xs font-semibold text-fog">
              {formatINR(s.price)}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
        <PageLink
          href={c.href}
          className="peel-btn inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-bold"
        >
          {c.cta} <ArrowRight className="size-4" />
        </PageLink>
        <PageLink
          href={c.href}
          className="hidden h-12 items-center px-2 text-sm font-semibold text-fog transition-colors hover:text-brand sm:inline-flex"
        >
          Bulk or special requests
        </PageLink>
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
      <div className="mt-2 flex items-baseline gap-3 sm:mt-6">
        <span className="font-display text-3xl font-bold text-gold sm:text-4xl">
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
          className="mt-3 flex flex-wrap gap-2 sm:mt-4"
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

      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
        <AddToCartButton
          product={product}
          stickerSize={size}
          size="lg"
          sticker
        />
        <PageLink
          href={`/sticker/${product.slug}`}
          className="peel-btn peel-btn--light inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-bold"
        >
          Details <ArrowRight className="size-4" />
        </PageLink>
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
        <PageLink
          href="/custom-stickers"
          className="group mt-4 hidden items-center gap-2.5 rounded-2xl border border-dashed border-brand/40 sm:inline-flex bg-ink2/80 px-4 py-2.5 text-sm backdrop-blur-sm transition-colors hover:border-brand sm:mt-5"
        >
          <ImageUp className="size-4.5 text-brand" />
          <span>
            <span className="font-semibold text-snow">
              Got your own design?
            </span>{" "}
            <span className="text-fog">Make your own sticker</span>
          </span>
          <ArrowRight className="size-4 text-brand transition-transform group-hover:translate-x-0.5" />
        </PageLink>
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
