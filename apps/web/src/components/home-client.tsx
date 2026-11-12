"use client";

import Link from "@/components/page-link";
import { Fragment, useMemo } from "react";
import Hero from "./hero";
import type { FanPoster } from "@/lib/hero-fan";
import ProductCard from "./product-card";
import { usePuzzleLead } from "@/lib/puzzle-mix";
import ProductCardSkeleton from "./product-card-skeleton";
import Row from "./row";
import CustomRail from "./custom-rail";
import LazyRail, { WALL_CARD_WIDTH } from "./lazy-rail";
import WallFeed, { feedBreaks, usePhone, type FeedBreak } from "./wall-feed";
import { isListed, isPosterPack } from "@/lib/poster";
import { rememberPosters } from "@/lib/poster-images";
import {
  WALL_MIX_ROW,
  arrangeWallRow,
  categoryPath,
  activeFestivals,
  festivalProducts,
  festivalShortDate,
  resolveHomeRails,
  isCalendarWall,
  wallInSeason,
  type Festival,
  type HomeSectionId,
  type Product,
  type HomeRail,
} from "@stickypie/shared";
import { useFestivals, useHomePage, useHomeRails, useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import { useSkinSeed } from "@/lib/skin-seed";
import { HOT_TAGS, HotContext, recentlyViewedIds, useTrending } from "@/lib/trending";
import { readInterest } from "@/lib/interest";
import { relatedOrder } from "@/lib/related";
import { useCart } from "./cart-context";
import { wallEffect } from "@/lib/wall-effects";

export default function HomeClient({
  initial,
  initialRails,
  initialFestivals,
  festivalPages,
  fanPosters,
}: {
  initial: Catalog;
  initialRails: HomeRail[];
  initialFestivals: Festival[];
  festivalPages: string[];
  fanPosters: FanPoster[];
}) {
  // Puzzle poster cards between the cards of every row.
  const mix = usePuzzleLead();
  const catalog = useLiveCatalog(initial);
  const { rails, loaded: railsLoaded } = useHomeRails(initialRails);
  const { festivals } = useFestivals(initialFestivals);
  const home = useHomePage();
  const { categories, products, failed, retry } = catalog;
  // What India searches right now, matched to our products (lib/trending.ts).
  const { trend, loaded: trendLoaded } = useTrending(products, categories);
  const loaded = catalog.loaded && railsLoaded && trendLoaded;
  const { items: cartItems } = useCart();
  useWindowScrollMemory(loaded);

  // Poster packs get the first row, wall setups leading; every other row is single stickers.
  rememberPosters(products);
  // Christmas & New Year walls only while those festivals are on (admin → Festivals dates).
  const onNow = new Set(activeFestivals(festivals).map((f) => f.id));
  const walls = products.filter((p) => isPosterPack(p) && wallInSeason(p.tags, onNow));
  // The 2027 calendar walls get a row of their own (admin → Home page → 2027 calendars),
  // and then stay out of the mix and the theme rows so no wall shows twice.
  const calendarsOn = home.sections.some((s) => s.id === "calendars" && s.visible);
  const calendars = calendarsOn ? arrangeWallRow(home.wallRows.calendars, walls.filter((p) => isCalendarWall(p.tags)), walls) : [];
  const packs = calendars.length > 0 ? walls.filter((p) => !isCalendarWall(p.tags)) : walls;
  // A row per wall theme, after the mix of every set.
  const inTheme = (id: string) => packs.filter((p) => p.tags.includes(`wall theme:${id}`));
  const wallRows = home.themes
    .filter((t) => t.visible)
    .map((t) => ({ ...t, items: arrangeWallRow(home.wallRows[t.id], inTheme(t.id), packs) }))
    .filter((t) => t.items.length > 0);
  const singles = products.filter((p) => !isPosterPack(p) && isListed(p));
  const featured = singles.filter((p) => p.featured);
  const hero = featured[0] ?? singles[0] ?? products[0];
  // Rails and their order come from the admin (Home page). What each rail shows
  // is a fresh, trend-weighted mix on every visit (a refresh reshuffles; Back
  // shows the page as it was).
  const seed = useSkinSeed();
  const wallMix = arrangeWallRow(home.wallRows[WALL_MIX_ROW], mixWalls(packs, seed, trend), packs);
  // festival rails come before the other rails: those never repeat their stickers
  const festivalItems = activeFestivals(festivals).flatMap((f) => festivalProducts(f, singles).slice(0, 24).map((p) => p.id));
  // Posters like the ones in this shopper's cart: a few for each of the newest lines.
  const cartIds = cartItems.map((i) => i.productId).join(",");
  const withCart = useMemo(() => {
    if (!loaded || !cartIds) return [];
    const inCart = new Set(cartIds.split(","));
    const byId = new Map(products.map((p) => [p.id, p]));
    const pool = singles.filter((p) => !inCart.has(p.id));
    const lists = [...inCart].reverse().slice(0, 3).flatMap((id) => (byId.get(id) ? [relatedOrder(byId.get(id)!, pool, seed).slice(0, 6)] : []));
    const out: Product[] = [];
    for (let i = 0; i < 6; i++) for (const l of lists) if (l[i] && !out.includes(l[i])) out.push(l[i]);
    return out;
    // singles follows products
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, cartIds, products, seed]);
  const trendScores = useMemo(() => new Map([...trend].map(([id, t]) => [id, t.score])), [trend]);
  const homeRails = useMemo(
    () =>
      !loaded
        ? []
        : resolveHomeRails(rails, singles, categories, seed, festivalItems, {
            trend: trendScores,
            interest: readInterest(),
            recent: recentlyViewedIds(),
            withCart,
          }),
    // singles / festivalItems follow products, festivals and rails
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, rails, products, categories, festivals, seed, trendScores, withCart],
  );
  // Trending and "Goes with your cart" open the page, right under the hero (on
  // phones too, ahead of the walls feed); the other rails keep their place.
  const leadKinds = new Set(["trending", "with-cart"]);
  const leadRails = homeRails.filter((r) => r.kind && leadKinds.has(r.kind));
  const otherRails = homeRails.filter((r) => !(r.kind && leadKinds.has(r.kind)));
  // The best matches carry a "Trending" tag on their card.
  const hot = useMemo(
    () => new Set([...trend].sort((a, b) => b[1].score - a[1].score).slice(0, HOT_TAGS).map(([id]) => id)),
    [trend],
  );
  // Phones get one wall feed in place of the wall rows, with the sections after it woven in.
  const phone = usePhone();
  const sectionOn = (id: HomeSectionId) => home.sections.some((s) => s.id === id && s.visible);
  const feedAt = !phone || wallMix.length === 0 ? null : sectionOn("walls") ? "walls" : sectionOn("themes") ? "themes" : null;
  // Festivals around today (admin → Festivals) come right after Make your own: from a few days
  // before the date to a few days after, then they step aside by themselves.
  const festivalRails = activeFestivals(festivals)
    .map((f) => ({ f, items: festivalProducts(f, singles).slice(0, 24) }))
    .filter(({ items }) => items.length > 0);

  // The hero never waits: it is on the first paint and stays mounted as the list arrives.
  const heroBanner = (
    <Hero
      products={!hero ? [] : featured.length > 0 ? featured : [hero]}
      packs={packs}
      categories={categories}
      moments={festivalRails.map(({ f, items }) => ({ label: `${f.name} · ${festivalShortDate(f)}`, products: items }))}
      fanPosters={fanPosters}
    />
  );

  // Placeholders until the live (on-sale only) list arrives — never stale cards.
  if (!loaded) {
    return (
      <>
        {heroBanner}
        <div aria-busy="true" aria-label="Loading stickers" className="mt-2 space-y-1 pb-24 sm:space-y-8">
          {["Top Picks This Week", "New Drops"].map((title) => (
            <Row key={title} title={title}>
              {Array.from({ length: 6 }, (_, i) => (
                <ProductCardSkeleton key={i} index={i} />
              ))}
            </Row>
          ))}
        </div>
      </>
    );
  }

  if (failed && products.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
        <p className="font-display text-2xl font-bold">Couldn&apos;t load the stickers</p>
        <p className="text-sm text-fog">Check your connection and try again.</p>
        <button
          type="button"
          onClick={retry}
          className="peel-btn peel-btn--brand mt-1 rounded-xl px-6 py-2.5 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  // Shoppers see this while the catalog is empty (e.g. a fresh production
  // database before the first products are added in the admin).
  if (!hero) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="size-16 -rotate-6 rounded-2xl"
        />
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Fresh stickers are on the way
        </h1>
        <p className="max-w-md text-fog">
          We&apos;re printing our first drop of die-cut vinyl stickers. Check back soon — or say
          hi in the meantime.
        </p>
        <Link
          href="/contact"
          className="peel-btn peel-btn--light mt-2 rounded-xl px-5 py-2 text-sm font-bold"
        >
          Contact us
        </Link>
      </div>
    );
  }

  // The page's sections, in the order set in the admin (Home page).
  const order = home.sections.filter((section) => section.visible).map((section) => section.id);
  // Every product the rows show as a card, so a puzzle card never brings one
  // back (until every poster has been shown once). Sections are built top to
  // bottom, and the phone feed builds its rows as it reaches them, so puzzle
  // cards pick in the order the shopper scrolls.
  const used = new Set<string>([
    ...festivalItems,
    ...homeRails.flatMap((r) => r.items.map((p) => p.id)),
    ...wallMix.map((p) => p.id),
    ...calendars.map((p) => p.id),
  ]);
  const festivalRow = ({ f, items }: (typeof festivalRails)[number], u: Set<string>) => (
    <LazyRail
      key={`festival-${f.id}`}
      eager
      title={`${f.name} · ${festivalShortDate(f)}`}
      href={festivalPages.includes(f.slug) ? `/${f.slug}` : `/stickers?q=${encodeURIComponent(f.tags[0] ?? f.name)}`}
    >
      {mix(items, { used: u }).map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </LazyRail>
  );
  // The first two rails render straight away; the rest only when the shopper
  // scrolls near them.
  const railRow = (rail: (typeof homeRails)[number], i: number, u: Set<string>) => (
    <LazyRail key={rail.key} eager={Boolean(feedAt) || i < 2} title={rail.title} href={rail.href}>
      {mix(rail.items, { used: u }).map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </LazyRail>
  );
  const isRow = (id: HomeSectionId): id is "festivals" | "rails" => id === "festivals" || id === "rails";
  // the phone feed's rows: the sections after it, built when the feed reaches them
  const feedRows: FeedBreak[] = !feedAt
    ? []
    : order.slice(order.indexOf(feedAt) + 1).filter(isRow).flatMap((id) =>
        id === "festivals"
          ? festivalRails.map((r) => (u: Set<string>) => festivalRow(r, u))
          : otherRails.map((r, i) => (u: Set<string>) => railRow(r, i, u)),
      );
  const feed = () => (
    <WallFeed
      title={home.wallsTitle}
      walls={wallMix}
      themes={sectionOn("themes") ? wallRows : []}
      breaks={feedBreaks(feedRows, sectionOn("custom") && <CustomRail />)}
      seed={seed}
      used={new Set(used)}
    />
  );

  const sections: Record<HomeSectionId, () => React.ReactNode> = {
    calendars: () => calendars.length > 0 && (
      <LazyRail eager wide title="2027 Calendars" href="/calendar-2027">
        {calendars.map((product) => (
          <ProductCard key={product.id} product={product} width={WALL_CARD_WIDTH} wallEffect={wallEffect(0, seed)} />
        ))}
      </LazyRail>
    ),
    walls: () => feedAt ? feedAt === "walls" && feed() : wallMix.length > 0 && (
      <LazyRail eager wide title={home.wallsTitle} href={categoryPath("poster-packs")}>
        {mix(wallMix, { used }).map((product) => (
          <ProductCard key={product.id} product={product} width={WALL_CARD_WIDTH} wallEffect={wallEffect(0, seed)} />
        ))}
      </LazyRail>
    ),
    themes: () => feedAt ? feedAt === "themes" && feed() : wallRows.map((row, i) => (
      <LazyRail key={row.id} eager={i < 1} wide title={row.title} href={`${categoryPath("poster-packs")}?theme=${row.id}`}>
        {mix(row.items, { used }).map((product) => (
          <ProductCard key={product.id} product={product} width={WALL_CARD_WIDTH} wallEffect={wallEffect(i + 1, seed)} />
        ))}
      </LazyRail>
    )),
    custom: () => <CustomRail />,
    festivals: () => festivalRails.map((r) => festivalRow(r, used)),
    rails: () => otherRails.map((r, i) => railRow(r, i, used)),
  };

  return (
    <HotContext.Provider value={hot}>
      {heroBanner}
      <div className="relative z-10 mt-2 space-y-1 pb-24 sm:space-y-8">
        {leadRails.map((r) => railRow(r, 0, used))}
        {/* built in page order, so puzzle cards higher up pick first */}
        {order
          .filter((id) => !feedAt || order.indexOf(id) <= order.indexOf(feedAt))
          .map((id) => (
            <Fragment key={id}>{sections[id]()}</Fragment>
          ))}
      </div>
    </HotContext.Provider>
  );
}

/**
 * Every wall set, one theme after another so none fills the row; a new order
 * each visit. Sets matching what India searches now tend to come first (and
 * their theme leads the round-robin).
 */
function mixWalls(packs: Product[], seed: number, trend: Map<string, { score: number }>): Product[] {
  const top = Math.max(0, ...[...trend.values()].map((t) => t.score));
  const heat = (p: Product) => (top > 0 ? (trend.get(p.id)?.score ?? 0) / top : 0);
  // weighted random key (u^(1/w)): hot sets usually sort first, the rest still move around
  const spin = (p: Product) => {
    const h = [...p.slug].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, seed >>> 0);
    return -Math.pow(((h >>> 0) % 1_000_003) / 1_000_003 || 1e-6, 1 / (1 + 5 * heat(p)));
  };
  const themeOf = (p: Product) => p.tags.find((t) => t.startsWith("wall theme:")) ?? "";
  const groups = new Map<string, Product[]>();
  for (const p of [...packs].sort((a, b) => spin(a) - spin(b))) {
    groups.set(themeOf(p), [...(groups.get(themeOf(p)) ?? []), p]);
  }
  const queues = [...groups.values()];
  const mix: Product[] = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) if (q.length) mix.push(q.shift()!);
  }
  return mix;
}
