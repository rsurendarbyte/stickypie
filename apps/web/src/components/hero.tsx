"use client";

import Link from "@/components/page-link";
import SmartImg from "./smart-img";
import PageLink from "./page-link";
import { isMiniPoster, isPosterPack, isRegional, isRegionalName, posterSetName, sizeChipLabel, wallPosterSizes, wallSize, wallSpots } from "@/lib/poster";
import { rememberPosters } from "@/lib/poster-images";
import WallStage from "./wall-stage";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarHeart,
  Frame,
  Gift,
  Car,
  ImageUp,
  Loader2,
  Ruler,
  Sparkles,
  Smile,
  Sticker,
  Truck,
} from "lucide-react";
import type {
  AvatarBook,
  AvatarStyle,
  Category,
  HomeHeroCopy,
  HomePage,
  Product,
} from "@stickypie/shared";
import {
  avatarBook,
  discountPercent,
  formatINR,
} from "@stickypie/shared";
import { cardSkinFor, tileFor } from "@/lib/palette";
import { useDaySeed, useSkinSeed } from "@/lib/skin-seed";
import AddToCartButton from "./add-to-cart-button";
import AvatarArt from "./avatar-art";
import { STYLE_DESIGNS, StickerArt, type ArtDesign } from "./custom-rail";
import PriceWait from "./price-wait";
import { useSizeChoice } from "./size-picker";
import TrueSizePreview from "./true-size-preview";
import {
  useFeatures,
  useHomePage,
  useLiveCatalog,
  useStoreSettings,
} from "@/lib/live-catalog";
import { readInterest, type Interest } from "@/lib/interest";

/** Rotating hero: the featured sticker is staged on a big tilted product card. */
export default function Hero({
  products,
  packs = [],
  categories,
  moments = [],
}: {
  products: Product[];
  /** Wall poster sets: a few of them take turns between the sticker slides. */
  packs?: Product[];
  categories: Category[];
  /** What's on now (festivals around today, soonest/admin order first) and their stickers. */
  moments?: { label: string; products: Product[] }[];
}) {
  const features = useFeatures();
  const settings = useStoreSettings();
  const seed = useSkinSeed();
  const daySeed = useDaySeed();
  const { products: catalog } = useLiveCatalog({
    categories: [],
    products: [],
  });
  const interest = useInterest();
  // A fresh mix for every shopper every day: categories take turns (the ones they
  // look at first), featured and new likelier, a cheap sticker and a mini poster in it.
  rememberPosters(catalog.length ? catalog : products);
  const home = useHomePage();
  // The hero speaks to all of India: nothing tied to one state or city (those keep their own rows).
  const regionId = categories.find((c) => c.slug === "cities-states")?.id;
  const national = (p: Product) => !home.hideRegional || !isRegional(p, regionId);
  const shop = (catalog.length ? catalog : products).filter(national);
  const wallSets = packs.filter(national);
  const { picks, packPicks, momentOf } = heroPicks(
    shop.filter((p) => !isPosterPack(p)),
    wallSets,
    interest,
    seed,
    home.festivals
      ? moments.filter((m) => !home.hideRegional || !isRegionalName(m.label)).map((m) => ({ ...m, products: m.products.filter(national) }))
      : [],
    home.productSlides,
    home.wallSlides,
  );
  // Sticker slides with a wall poster set after every second one.
  const productSlides: Slide[] = [];
  const queue = [...packPicks];
  picks.forEach((p, i) => {
    productSlides.push({ kind: "product", product: p });
    if (i % 2 === 1 && queue.length) productSlides.push({ kind: "product", product: queue.shift()! });
  });
  for (const p of queue) productSlides.push({ kind: "product", product: p });
  // The slides and their order come from the admin (Home page).
  const book = features.avatarStickers ? avatarBook(settings) : null;
  const slides: Slide[] = home.slides
    .filter((s) => s.visible)
    .flatMap((s): Slide[] => {
      if (s.id === "avatar") return book ? [{ kind: "avatar" }] : [];
      if (s.id === "stickers") return shop.length ? [{ kind: "brand" }] : [];
      if (s.id === "posters") return shop.some(isMiniPoster) ? [{ kind: "posters" }] : [];
      return productSlides;
    });
  if (!slides.length) slides.push(...(productSlides.length ? productSlides : [{ kind: "brand" } as const]));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Shopper picked a size → stop rotating so the slide doesn't change under them.
  const [engaged, setEngaged] = useState(false);
  const slide = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    if (slides.length < 2 || paused || engaged) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      home.seconds * 1000,
    );
    return () => clearInterval(timer);
    // index: a swipe or dot tap restarts the wait for the next slide.
  }, [slides.length, paused, engaged, index, home.seconds]);

  // Swipe left / right on phones to change slide.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (step: number) =>
    setIndex((i) => (i + step + slides.length) % slides.length);

  if (!slide) return null;
  const product = slide.kind === "product" ? slide.product : null;
  const key = product ? product.id : slide.kind;
  // The words sit on a moving wall on these slides.
  const onWall = slide.kind !== "product";
  const posterChips = slide.kind === "posters" || (product !== null && isPosterPack(product));
  const chipIcons =
    slide.kind === "avatar" ? [Sticker, Frame, Gift, Truck] : posterChips ? [BadgeCheck, Gift, Frame, Truck] : [Sticker, BadgeCheck, Car, Truck];
  const chipLabels =
    slide.kind === "avatar"
      ? home.avatar.chips
      : slide.kind === "posters"
        ? home.posters.chips
        : slide.kind === "brand"
          ? home.stickers.chips
          : posterChips
            ? home.posterChips
            : home.stickerChips;
  const chips = chipLabels.flatMap((label, i) => (label ? [{ icon: chipIcons[i], label }] : []));
  const skinSlug = product
    ? product.slug
    : slide.kind === "avatar"
      ? "avatar-stickers"
      : slide.kind === "posters"
        ? "wall-posters"
        : "stickypie";

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
      className="relative flex items-center overflow-x-clip md:min-h-[70svh]"
    >
      {/* Background: the slide's sticker sheet / cutting mat fills the hero and
          fades softly into the page below (no hard edge). */}
      <div
        aria-hidden
        style={skin.art}
        className="pointer-events-none absolute inset-0 transition-[background-color] duration-700 [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]"
      />
      {onWall && (
        <>
          {slide.kind !== "avatar" ? (
            <BrandSlideArt
              key={slide.kind}
              stickers={wallItems(
                shop,
                slide.kind === "posters",
                daySeed,
              )}
            />
          ) : (
            <AvatarBookWall key="book-wall" styles={settings.avatarStyles} packs={wallSets} />
          )}
          {/* white wash behind the words: from below on phones, from the left on anything wider */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.9)_42%,rgba(255,255,255,0.15)_75%,transparent_100%)] sm:max-md:bg-[linear-gradient(to_right,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.88)_50%,rgba(255,255,255,0.4)_72%,transparent_88%)] md:bg-[linear-gradient(to_right,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.92)_40%,rgba(255,255,255,0.35)_54%,transparent_66%)] lg:bg-[linear-gradient(to_right,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.9)_30%,rgba(255,255,255,0.35)_42%,transparent_52%)]"
          />
        </>
      )}
      <div
        className="pointer-events-none absolute top-1/3 -right-44 size-[32rem] rounded-full blur-[140px] transition-colors duration-700"
        style={{ background: `${tile.glow}1f` }}
      />

      <div
        className={`relative grid w-full items-center gap-3 px-4 pt-[68px] pb-5 sm:gap-8 sm:px-8 sm:pt-24 md:grid-cols-[1fr_1.2fr] md:gap-8 lg:gap-14 lg:px-12 md:pb-10 2xl:px-20 ${onWall ? "pointer-events-none" : ""}`}
      >
        {/* Copy: every slide is laid out in the same cell, so the hero keeps the
            height of the tallest slide and never jumps as slides change. */}
        {/* z-10: on phones the sticker can reach down behind the text — it stays a backdrop */}
        {/* Small tablets: on the wall slides the picture box above is empty
            (the wall is the backdrop), so the words slide up into it — a shift only, the
            hero keeps its height and the page below never jumps between slides. */}
        <div
          className={`pointer-events-auto relative z-10 order-2 grid max-w-2xl md:order-1 ${onWall ? "sm:max-md:-translate-y-[min(42svh,28.8rem)]" : ""}`}
        >
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
                // Small tablets: the StickyPie and avatar text sits at the top (the
                // wall fills the hero behind it), not at the foot of the tallest slide's space.
                className={`col-start-1 row-start-1 self-end md:max-xl:self-center ${s.kind !== "product" ? "sm:max-md:self-start" : ""} ${active ? "animate-hero-in" : "pointer-events-none invisible"}`}
              >
                {s.kind === "product" ? (
                  <ProductSlideCopy
                    product={s.product}
                    moment={momentOf.get(s.product.id)}
                    categoryName={
                      categories.find((c) => c.id === s.product.categoryId)
                        ?.name
                    }
                    onPickSize={() => setEngaged(true)}
                  />
                ) : s.kind === "brand" ? (
                  <BrandSlideCopy
                    catalog={catalog.length ? catalog : products}
                    copy={home.stickers}
                  />
                ) : s.kind === "posters" ? (
                  <PosterSlideCopy
                    catalog={catalog.length ? catalog : products}
                    copy={home.posters}
                  />
                ) : (
                  <AvatarSlideCopy book={book!} catalog={catalog.length ? catalog : products} copy={home.avatar} />
                )}
              </div>
            );
          })}

          {slides.length > 1 && (
            <div className="col-start-1 row-start-2 mt-4 flex items-center justify-center gap-2 sm:row-start-3 sm:mt-5 sm:justify-start md:hidden">
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
          <ul className="col-start-1 row-start-2 mt-8 hidden flex-wrap gap-2 text-[11px] font-semibold tracking-wide text-fog sm:flex md:max-xl:hidden">
            {chips.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-3 py-1.5">
                <Icon className="size-3.5 text-mint" /> {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Artwork, floating on the mat */}
        <div
          className={`relative z-0 order-1 mx-auto w-full max-w-[360px] sm:max-w-xl md:order-2 ${onWall ? "pointer-events-none [&_button]:pointer-events-auto" : ""} md:mx-0 md:max-w-none`}
        >
          {/* product-tinted wash behind the art (not on the wall slides: it fogs the wall) */}
          {!onWall && (
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
            className="animate-hero-img-in relative aspect-[5/4] max-sm:max-h-[38svh] max-sm:w-full sm:aspect-[5/4] sm:max-md:max-h-[42svh] sm:max-md:w-full md:aspect-auto md:h-[min(50vh,560px)]"
          >
            {product ? (
              // Tapping the art opens the sticker: the swipe view on phones,
              // its page on desktop (the sticker page picks).
              <PageLink
                href={`/sticker/${product.slug}`}
                aria-label={`View ${product.name}`}
                draggable={false}
                // one fixed-size cell, so max-h-full has a height to fit tall art (posters) into
                className="absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center p-2 sm:p-4 md:px-6 md:pt-0 md:pb-5"
              >
                {wallSpots(product).length > 0 ? (
                  <WallStage bare priority product={product} src={product.thumbUrl ?? product.imageUrl} alt={product.name} />
                ) : (
                <SmartImg
                  full={product.imageUrl}
                  thumb={product.thumbUrl}
                  alt={product.name}
                  priority
                  // a wall poster set's collage stands straight with rounded corners, like its card
                  className={`animate-float max-h-full max-w-full cursor-pointer object-contain transition-transform duration-200 hover:scale-[1.03] md:max-h-[min(46vh,520px)] ${isPosterPack(product) ? "rounded-2xl shadow-[0_24px_50px_-20px_rgba(16,24,40,0.45)]" : "sticker-cut rotate-2"}`}
                />
                )}
              </PageLink>
            ) : null}
          </div>

          {/* Slide indicator */}
          {slides.length > 1 && (
            <div className="relative z-10 mt-7 hidden items-center justify-center gap-2 md:flex">
              {slides.map((s, i) => (
                <button
                  key={s.kind === "product" ? s.product.id : s.kind}
                  type="button"
                  aria-label={
                    s.kind === "product"
                      ? `Show ${s.product.name}`
                      : s.kind === "avatar"
                        ? "Show avatar stickers"
                        : s.kind === "posters"
                          ? "Show wall posters"
                          : "Show stickers"
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
  | { kind: "posters" }
  | { kind: "avatar" };

/** "150+ designs · from ₹80" for a slide's own products. */
function SlideFacts({ items }: { items: Product[] }) {
  if (!items.length) return null;
  const from = Math.min(...items.map((p) => p.price));
  // Rounded down to a friendly "100+" style number.
  const count = items.length >= 20 ? `${Math.floor(items.length / 10) * 10}+` : `${items.length}`;
  return (
    <p className="mt-3 text-sm font-semibold text-snow sm:mt-5">
      {count} designs · from <span className="font-display text-gold">{formatINR(from)}</span>
    </p>
  );
}

/** First slide: stickers in one line, a few quick facts, and two ways to order. */
function BrandSlideCopy({ catalog, copy }: { catalog: Product[]; copy: HomeHeroCopy }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
        <Sticker className="size-3.5" /> {copy.badge}
      </span>
      <h2 className="mt-2.5 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl md:text-5xl xl:mt-5 xl:text-[64px]">
        {copy.title}
      </h2>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-fog sm:mt-4 sm:text-lg">
        {copy.text}
      </p>
      <SlideFacts items={catalog.filter((p) => !isMiniPoster(p) && !isPosterPack(p))} />
      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
        <PageLink
          href="/stickers"
          className="peel-btn inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold sm:h-12 sm:px-6 sm:text-base"
        >
          {copy.button} <ArrowRight className="size-4" />
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

/** Second slide: wall posters, kept apart from the stickers. */
function PosterSlideCopy({ catalog, copy }: { catalog: Product[]; copy: HomeHeroCopy }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
        <Frame className="size-3.5" /> {copy.badge}
      </span>
      <h2 className="mt-2.5 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl md:text-5xl xl:mt-5 xl:text-[64px]">
        {copy.title}
      </h2>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-fog sm:mt-4 sm:text-lg">
        {copy.text}
      </p>
      <SlideFacts items={catalog.filter((p) => isMiniPoster(p) && !isPosterPack(p))} />
      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
        <PageLink
          href="/stickers/mini-posters"
          className="peel-btn inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold sm:h-12 sm:px-6 sm:text-base"
        >
          {copy.button} <ArrowRight className="size-4" />
        </PageLink>
      </div>
    </>
  );
}

/** This shopper's viewed categories (read in the browser after the first paint). */
function useInterest(): Interest {
  const [interest, setInterest] = useState<Interest>({});
  useEffect(() => setInterest(readInterest()), []);
  return interest;
}

/**
 * The hero's stickers and wall poster sets, new for every shopper every day (steady
 * while they browse): stickers for what's on now (a festival around today) lead, then
 * categories take turns so the slides show different kinds of
 * stickers — the categories this shopper has been looking at first — featured and
 * new ones are likelier, and there's always a cheap sticker and a mini poster in
 * the mix. Out-of-stock ones never show.
 */
function heroPicks(
  singles: Product[],
  packs: Product[],
  interest: Interest,
  seed: number,
  moments: { label: string; products: Product[] }[],
  productCount: number,
  wallCount: number,
) {
  const day = Math.floor(Date.now() / 86_400_000);
  const random = seededRandom(seed * 7919 + day);
  const weight = (p: Product) => (p.featured ? 3 : 1) * (p.isNew ? 2 : 1);
  // weighted shuffle: highest random^(1/weight) first
  const shuffle = <T,>(list: T[], w: (x: T) => number) =>
    list
      .map((x) => ({ x, key: Math.pow(random(), 1 / w(x)) }))
      .sort((a, b) => b.key - a.key)
      .map((o) => o.x);
  const inStock = singles.filter((p) => p.stock !== 0);
  const groups = new Map<string, Product[]>();
  for (const p of inStock) {
    const key = p.categoryId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  // categories they've looked at count 4× per view (capped), the rest by size of choice
  const order = shuffle([...groups.keys()], (c) => 1 + Math.min(interest[c] ?? 0, 5) * 4);
  const queues = order.map((c) => shuffle(groups.get(c)!, weight));
  // What's on now first: two stickers of the soonest festival (one each when two are on).
  const momentOf = new Map<string, string>();
  const live = moments.filter((m) => m.products.some((p) => p.stock !== 0)).slice(0, 2);
  for (const m of live) {
    const take = shuffle(m.products.filter((p) => p.stock !== 0 && !isPosterPack(p) && !momentOf.has(p.id)), weight)
      .slice(0, live.length === 1 ? 2 : 1);
    for (const p of take) momentOf.set(p.id, m.label);
  }
  const picks: Product[] = [];
  const festive = [...momentOf.keys()].map((id) => singles.find((p) => p.id === id)).filter(Boolean) as Product[];
  for (const q of queues) for (let i = q.length - 1; i >= 0; i--) if (momentOf.has(q[i].id)) q.splice(i, 1);
  while (picks.length < productCount - festive.length && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && picks.length < productCount - festive.length) picks.push(q.shift()!);
  }
  // festival stickers first and third, so the hero opens on what's on now
  festive.forEach((p, i) => picks.splice(Math.min(i * 2, picks.length), 0, p));
  // a cheap sticker and a mini poster both in the mix (swap the last pick if needed)
  const ensure = (want: (p: Product) => boolean) => {
    if (picks.length < 2 || picks.some(want)) return;
    const extra = shuffle(inStock.filter((p) => want(p) && !picks.includes(p)), weight)[0];
    // swap the last pick that isn't a festival one
    const at = picks.findLastIndex((p) => !momentOf.has(p.id));
    if (extra && at >= 0) picks[at] = extra;
  };
  ensure(isMiniPoster);
  ensure((p) => !isMiniPoster(p));
  const packPicks = shuffle(
    packs.filter((p) => p.stock !== 0),
    (p) => (p.featured ? 3 : 1) * (p.isNew ? 1.5 : 1),
  ).slice(0, wallCount);
  return { picks, packPicks, momentOf };
}

/** What a banner wall shows: only stickers or only mini posters, so the two never
 *  mix — never poster packs (a pack's picture is a whole wall, not one sticker).
 *  Categories take turns (one from each, round and round) so no single one —
 *  a festival's dozen posters, say — fills the wall; the mix changes each day. */
function wallItems(everything: Product[], posters: boolean, seed: number) {
  const pool = everything.filter((p) => !isPosterPack(p) && isMiniPoster(p) === posters);
  const random = seededRandom(seed);
  const mix = <T,>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const groups = new Map<string, Product[]>();
  for (const p of pool) {
    const key = p.categoryId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const queues = mix([...groups.values()].map((g) => mix([...g])));
  const out: Product[] = [];
  while (out.length < 30 && queues.some((q) => q.length)) {
    for (const q of queues) if (q.length && out.length < 30) out.push(q.shift()!);
  }
  return out;
}

/** Small repeatable random numbers (mulberry32): same seed, same wall. */
function seededRandom(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * First slide's backdrop: a wall of real stickers filling the whole hero —
 * columns scrolling up and down (alternating), tilted diagonally, fading out
 * at the top and bottom. Tiles size with the screen, so it fills any device.
 * Each sticker opens its page; the wall keeps moving the whole time.
 */
/** How many columns, and tiles per column, the wall needs to cover its box —
 *  measured in the browser, so only what can show is drawn (a phone draws ~60
 *  tiles, a wide screen ~120, instead of 210 everywhere). */
function useWallSize(box: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ cols: number; perCol: number } | null>(
    null,
  );
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      if (!w || !h) return;
      const vw = window.innerWidth;
      const step =
        Math.min(Math.max(92, vw * 0.13), 170) + (vw >= 640 ? 16 : 12);
      const sin = Math.sin((14 * Math.PI) / 180);
      const cos = Math.cos((14 * Math.PI) / 180);
      // the tilted wall's width across the box, and the box's length along a
      // column (one copy of a column must be at least that long — see below)
      const cols = Math.ceil((w * cos + h * sin) / step) + 1;
      const perCol = Math.ceil((w * sin + h * cos) / step);
      setSize((s) =>
        s && s.cols === cols && s.perCol === perCol ? s : { cols, perCol },
      );
    };
    measure();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [box]);
  return size;
}

function BrandSlideArt({ stickers }: { stickers: Product[] }) {
  const box = useRef<HTMLDivElement>(null);
  const size = useWallSize(box);
  // Phones show a small wall: a dozen different pictures (tiles repeat) is
  // plenty, and far less to download on a slow connection.
  const pool = size && size.cols * size.perCol < 90 ? stickers.slice(0, 12) : stickers;
  if (!pool.length) return null;
  const columns = size
    ? Array.from({ length: size.cols }, (_, c) =>
        Array.from(
          { length: size.perCol },
          (_, k) => pool[(c * 7 + k * 4) % pool.length],
        ),
      )
    : [];
  return (
    // Phones: the wall only fills the top of the hero (the words sit on white
    // below it), so it's a smaller box with far fewer tiles.
    <div
      ref={box}
      className="sticker-wall animate-hero-img-in absolute inset-x-0 top-0 bottom-[38%] overflow-hidden sm:bottom-0"
    >
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] gap-3 sm:gap-4">
        {columns.map((col, c) => (
          <div key={c} className="w-[clamp(92px,13vw,170px)] shrink-0">
            {/* two copies stacked, sliding by one copy around the middle: it
                loops without a seam, and one copy covers the box, so the screen
                never reaches either end */}
            <div
              className={`flex flex-col gap-3 sm:gap-4 ${c % 2 ? "sticker-wall-down" : "sticker-wall-up"}`}
              // same speed as before, whatever the column's length
              style={{
                animationDuration: `${((44 + (c % 4) * 7) * col.length) / 7}s`,
              }}
            >
              {[...col, ...col].map((p, k) => {
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
                      <span className="wall-peel wall-peel-poster relative size-full">
                        <img
                          src={p.thumbUrl ?? p.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="wall-peel-front wall-poster absolute inset-0 size-full object-cover"
                        />
                        <span
                          aria-hidden
                          className="wall-peel-shadow absolute inset-0"
                        >
                          <img
                            src={p.thumbUrl ?? p.imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
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
                          decoding="async"
                          fetchPriority="low"
                          className="wall-peel-front absolute inset-0 size-full object-contain"
                        />
                        <span
                          aria-hidden
                          className="wall-peel-shadow absolute inset-0"
                        >
                          <img
                            src={p.thumbUrl ?? p.imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
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

/** A sticker slide's text: badges, name, description, price and buy controls. */
function ProductSlideCopy({
  product,
  moment,
  categoryName,
  onPickSize,
}: {
  product: Product;
  /** Picked for what's on now ("Diwali · 8 Nov"): said on the badge. */
  moment?: string;
  categoryName: string | undefined;
  onPickSize: () => void;
}) {
  const pack = isPosterPack(product);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white/90 px-3 py-1 text-[10px] font-bold tracking-widest text-brand uppercase shadow-sm backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-[11px]">
          {moment ? (
            <>
              <CalendarHeart className="size-3.5" /> {moment}
            </>
          ) : pack ? (
            <>
              <Frame className="size-3.5" /> Wall poster set
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />{" "}
              {product.isNew ? "New drop" : product.featured ? "Featured drop" : "Today's pick"}
            </>
          )}
        </span>
        {categoryName && !pack && (
          <span className="rounded-full border border-line bg-ink2 px-3 py-1 text-[10px] font-semibold tracking-widest text-fog uppercase sm:px-3.5 sm:py-1.5 sm:text-[11px]">
            {categoryName}
          </span>
        )}
      </div>
      {/* The page's H1 is in the shop intro below; a rotating product isn't the page topic. */}
      <h2 className="mt-2 line-clamp-2 font-display text-[24px] leading-[1.1] font-bold tracking-tight sm:mt-4 sm:text-6xl md:text-4xl xl:mt-5 xl:text-[64px]">
        {pack ? posterSetName(product.name) : product.name}
      </h2>
      {pack && (
        <p className="mt-2 text-sm font-semibold text-snow sm:mt-3 sm:text-base">
          {wallPosterSizes(product)}
          {wallSize(product) && ` · about ${wallSize(product)} on your wall`}
        </p>
      )}
      {!pack && (
        <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-fog sm:line-clamp-2 sm:text-lg md:hidden xl:line-clamp-3">
          {product.description}
        </p>
      )}
      <HeroBuy product={product} onPickSize={onPickSize} />
    </>
  );
}

function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Avatar slide backdrop: a wall of style tiles filling the hero, moving like
 * the first slide's sticker wall, in a new random order every visit. Each tile
 * is one style's card picture (a girl's or a boy's avatar sticker, from admin →
 * Avatar sheets) with the style's name, or a drawn stand-in avatar for a style
 * with no card picture yet.
 */
/** Wall tiles show their sticker the same ways as the "Make your own" cards (A, C, D, E). */
const WALL_DESIGNS: ArtDesign[] = ["frame", ...STYLE_DESIGNS];

type WallTile =
  | { kind: "avatar"; label: string; url: string | null }
  | { kind: "pack"; label: string; url: string; slug: string };

function AvatarBookWall({ styles, packs }: { styles: AvatarStyle[]; packs: Product[] }) {
  const box = useRef<HTMLDivElement>(null);
  const size = useWallSize(box);
  // Shuffled in the browser only (the wall isn't drawn on the server anyway).
  const [pools, setPools] = useState<{ avatars: WallTile[]; sets: WallTile[] }>({ avatars: [], sets: [] });
  useEffect(() => {
    // Every card picture, plus a drawn stand-in for each style that has none.
    const real = styles.flatMap((s) =>
      s.covers.map((url) => ({ kind: "avatar" as const, label: s.label, url })),
    );
    const drawn = styles
      .filter((s) => !s.covers.length)
      .map((s) => ({ kind: "avatar" as const, label: s.label, url: null }));
    const sets = packs.map((p) => ({
      kind: "pack" as const,
      label: posterSetName(p.name).replace(/\s+Wall Setup$/i, ""),
      url: p.thumbUrl ?? p.imageUrl,
      slug: p.slug,
    }));
    // phones: a dozen different pictures of each is plenty for the small wall
    const few = window.innerWidth < 640 ? 12 : Infinity;
    setPools({ avatars: shuffled([...real, ...drawn]).slice(0, few), sets: shuffled(sets).slice(0, few) });
  }, [styles, packs]);
  // One column of AI stickers, then two columns of wall poster sets, and again
  // (only AI stickers when there are no sets, and the other way round).
  const kindOf = (c: number) =>
    !pools.sets.length ? pools.avatars : !pools.avatars.length ? pools.sets : c % 3 === 0 ? pools.avatars : pools.sets;
  const columns =
    size && (pools.avatars.length || pools.sets.length)
      ? Array.from({ length: size.cols }, (_, c) => {
          const pool = kindOf(c);
          const per = Math.ceil(size.perCol * 0.8) + 1;
          return Array.from({ length: per }, (_, k) => ({
            page: pool[(c * 5 + k * 3) % pool.length],
            n: c * 31 + k * 17,
          }));
        })
      : [];
  return (
    <div
      ref={box}
      className="sticker-wall animate-hero-img-in absolute inset-x-0 top-0 bottom-[38%] overflow-hidden sm:bottom-0"
    >
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] gap-3 sm:gap-4">
        {columns.map((col, c) => (
          <div key={c} className="w-[clamp(92px,13vw,170px)] shrink-0">
            <div
              className={`flex flex-col gap-3 sm:gap-4 ${c % 2 ? "sticker-wall-down" : "sticker-wall-up"}`}
              style={{
                animationDuration: `${((44 + (c % 4) * 7) * col.length) / 5}s`,
              }}
            >
              {[...col, ...col].map(({ page, n }, k) => (
                <Link
                  key={k}
                  href={page.kind === "pack" ? `/sticker/${page.slug}` : "/avatar-stickers"}
                  tabIndex={-1}
                  aria-label={page.kind === "pack" ? `${page.label} wall poster set` : "Make your avatar sticker packs"}
                  className={`block overflow-hidden rounded-xl bg-white shadow-[0_12px_26px_-14px_rgba(16,24,40,0.4)] ring-1 ring-black/5 transition-transform duration-200 hover:scale-[1.04] ${
                    k % 3 === 1 ? "rotate-2" : k % 3 === 2 ? "-rotate-1" : ""
                  }`}
                >
                  {page.kind === "pack" ? (
                    // a wall poster set: the whole picture, nothing cut off
                    <img
                      src={page.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      className="block aspect-square w-full bg-[#f4f1ec] object-contain"
                    />
                  ) : page.url ? (
                    // the same picture designs as the "Make your own" cards: A, C, D, E mixed
                    <StickerArt
                      design={WALL_DESIGNS[n % WALL_DESIGNS.length]}
                      pictures={
                        <img
                          src={page.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="col-start-1 row-start-1 h-full min-h-0 w-full object-contain drop-shadow-[0_6px_10px_rgba(16,24,40,0.25)]"
                        />
                      }
                    />
                  ) : (
                    <span className="block aspect-square bg-gradient-to-br from-brand-soft to-[#eef6ff] p-[7%]">
                      {/* a drawn stand-in until the admin uploads a card picture */}
                      <AvatarArt
                        style={page.label}
                        mood={n % 4}
                        className="size-full rounded-[22%] border-[3px] border-white shadow-sm"
                      />
                    </span>
                  )}
                  <span className="block truncate px-2 py-1.5 text-[clamp(9px,0.9vw,12px)] font-bold text-snow">
                    {page.label}
                    {page.kind === "pack" && <span className="font-semibold text-brand"> · wall set</span>}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Avatar slide: a sticker book of you from a photo, its price and the call to action. */
/**
 * Start loading the avatar page the moment the shopper shows intent (finger
 * down, mouse over, focus) rather than on click: the page is built by the
 * Worker (fresh admin prices), so this hides its response time. Chrome
 * prerenders it outright (speculation rules), others prefetch it. Once per
 * page view, so it costs at most one extra request and only on intent.
 */
let avatarWarm = false;
function warmAvatarPage() {
  if (avatarWarm || typeof document === "undefined") return;
  avatarWarm = true;
  if (HTMLScriptElement.supports?.("speculationrules")) {
    const rules = document.createElement("script");
    rules.type = "speculationrules";
    rules.textContent = JSON.stringify({
      prerender: [{ urls: ["/avatar-stickers"], eagerness: "immediate" }],
    });
    document.head.append(rules);
  } else {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = "/avatar-stickers";
    link.as = "document";
    document.head.append(link);
  }
}

/** First slide: the shop's two big things, side by side, each with its price and its way in. */
function AvatarSlideCopy({ book, catalog, copy }: { book: AvatarBook; catalog: Product[]; copy: HomePage["avatar"] }) {
  const { loaded: pricesReady } = useStoreSettings();
  const walls = catalog.filter(isPosterPack);
  // The first word of the title carries the brand colour.
  const [lead, ...restOfTitle] = copy.titleTop.split(" ");
  // Tapped: show progress at once while the next page loads.
  const [going, setGoing] = useState(false);
  // Back button from the avatar page restores this page from cache: drop the spinner.
  useEffect(() => {
    const reset = () => setGoing(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <>
      {/* AI up front: a solid AI tag beside the badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="pie-gradient inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-extrabold tracking-widest text-white uppercase shadow-md shadow-brand/30">
          <Sparkles className="size-3.5" /> AI
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-brand uppercase backdrop-blur-sm">
          <Smile className="size-3.5" /> {copy.badge}
        </span>
      </div>
      <h2 className="mt-2.5 font-display text-[30px] leading-[1.05] font-bold tracking-tight sm:mt-4 sm:text-6xl md:text-5xl xl:mt-5 xl:text-[64px]">
        <span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">
          {lead}
        </span>{" "}
        {restOfTitle.join(" ")}
        <br />
        {copy.titleBottom}
      </h2>
      <div className="mt-3 grid max-w-xl grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
        <div className="flex flex-col rounded-2xl border border-line bg-white/85 p-3 backdrop-blur-sm sm:p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-snow sm:text-base">
            <Smile className="size-4 shrink-0 text-brand" /> {copy.stickerTitle}
          </p>
          <p className="mt-1 flex-1 text-xs leading-snug text-fog sm:text-sm">
            {copy.stickerText.replace("{styles}", String(book.pages))}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold text-gold sm:text-2xl">
              {pricesReady ? formatINR(book.price) : <PriceWait className="w-14" />}
            </span>
            <span className="text-xs text-fog">per pack</span>
          </p>
          <PageLink
            href="/avatar-stickers"
            onPointerEnter={warmAvatarPage}
            onPointerDown={warmAvatarPage}
            onTouchStart={warmAvatarPage}
            onFocus={warmAvatarPage}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0)
                setGoing(true);
            }}
            aria-busy={going || undefined}
            className="peel-btn mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-bold sm:mt-3 sm:h-11 sm:text-sm"
          >
            {copy.stickerButton}{" "}
            {going && <Loader2 className="size-4 animate-spin" />}
          </PageLink>
        </div>
        <div className="flex flex-col rounded-2xl border border-line bg-white/85 p-3 backdrop-blur-sm sm:p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-snow sm:text-base">
            <Frame className="size-4 shrink-0 text-brand" /> {copy.wallTitle}
          </p>
          <p className="mt-1 flex-1 text-xs leading-snug text-fog sm:text-sm">
            {copy.wallText}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            {walls.length > 0 ? (
              <>
                <span className="text-xs text-fog">from</span>
                <span className="font-display text-xl font-bold text-gold sm:text-2xl">
                  {formatINR(Math.min(...walls.map((p) => p.price)))}
                </span>
              </>
            ) : (
              <PriceWait className="w-14" />
            )}
          </p>
          <PageLink
            href="/stickers/poster-packs"
            className="peel-btn mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-bold sm:mt-3 sm:h-11 sm:text-sm"
          >
            {copy.wallButton}
          </PageLink>
        </div>
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
      <div className="mt-1.5 flex items-center gap-2.5 sm:mt-6 sm:items-baseline sm:gap-3">
        <span className="font-display text-[28px] leading-none font-bold text-gold sm:text-4xl">
          {formatINR(price)}
        </span>
        {compareAtPrice !== null && compareAtPrice > price && (
          <>
            <span className="text-base text-fog/80 line-through sm:text-lg">
              {formatINR(compareAtPrice)}
            </span>
            {off !== null && (
              <span className="rounded-full border border-mint/30 bg-mint/15 px-2 py-0.5 text-[11px] font-bold text-mint sm:px-2.5 sm:py-1 sm:text-xs">
                SAVE {off}%
              </span>
            )}
          </>
        )}
        {sizes.length > 0 && (
          // phones: here, beside the price; bigger screens: next to the buttons
          <button
            type="button"
            onClick={() => {
              setTrueSize(true);
              onPickSize();
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-fog transition-colors hover:text-brand sm:hidden"
          >
            <Ruler className="size-3.5" /> Actual size
          </button>
        )}
      </div>

      {sizes.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Sticker size"
          className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:flex sm:flex-wrap"
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
                className={`inline-flex items-baseline justify-center gap-1.5 rounded-xl border px-2 py-2 transition-all sm:px-3.5 ${
                  active
                    ? "border-brand bg-brand/[0.07] ring-1 ring-brand"
                    : "border-line bg-ink2/80 backdrop-blur-sm hover:border-snow/30"
                }`}
              >
                <span className="font-display text-base font-bold">
                  {sizeChipLabel(product, s.inches)}
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

      <div className="mt-3 flex items-center gap-2.5 sm:mt-6 sm:flex-wrap sm:gap-3">
        <AddToCartButton
          product={product}
          stickerSize={size}
          size="lg"
          sticker
          className="max-sm:min-w-0 max-sm:flex-1 max-sm:px-4"
        />
        <PageLink
          href={`/sticker/${product.slug}`}
          className="peel-btn peel-btn--light inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-base font-bold sm:px-6"
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
            className="hidden h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fog transition-colors hover:text-brand sm:inline-flex"
          >
            <Ruler className="size-4" /> Actual size
          </button>
        )}
      </div>
      {features.customStickers && !isPosterPack(product) && (
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
