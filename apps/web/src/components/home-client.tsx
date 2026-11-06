"use client";

import Link from "@/components/page-link";
import { Children, Fragment } from "react";
import Hero from "./hero";
import type { FanPoster } from "@/lib/hero-fan";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import Row from "./row";
import CustomRail from "./custom-rail";
import LazyRail, { WALL_CARD_WIDTH } from "./lazy-rail";
import WallFeed, { feedBreaks, usePhone } from "./wall-feed";
import { isPosterPack } from "@/lib/poster";
import { rememberPosters } from "@/lib/poster-images";
import {
  WALL_MIX_ROW,
  arrangeWallRow,
  categoryPath,
  activeFestivals,
  festivalProducts,
  festivalShortDate,
  resolveHomeRails,
  type Festival,
  type HomeSectionId,
  type Product,
  type HomeRail,
} from "@stickypie/shared";
import { useFestivals, useHomePage, useHomeRails, useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import { useDaySeed } from "@/lib/skin-seed";
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
  const catalog = useLiveCatalog(initial);
  const { rails, loaded: railsLoaded } = useHomeRails(initialRails);
  const { festivals } = useFestivals(initialFestivals);
  const home = useHomePage();
  const { categories, products, failed, retry } = catalog;
  const loaded = catalog.loaded && railsLoaded;
  useWindowScrollMemory(loaded);

  // Poster packs get the first row, wall setups leading; every other row is single stickers.
  rememberPosters(products);
  const packs = products.filter(isPosterPack);
  // A row per wall theme, after the mix of every set.
  const inTheme = (id: string) => packs.filter((p) => p.tags.includes(`wall theme:${id}`));
  const wallRows = home.themes
    .filter((t) => t.visible)
    .map((t) => ({ ...t, items: arrangeWallRow(home.wallRows[t.id], inTheme(t.id), packs) }))
    .filter((t) => t.items.length > 0);
  const singles = products.filter((p) => !isPosterPack(p));
  const featured = singles.filter((p) => p.featured);
  const hero = featured[0] ?? singles[0] ?? products[0];
  // Rails and their order come from the admin (Home page); what each rail
  // shows changes once a day, not on every refresh.
  const seed = useDaySeed();
  const wallMix = arrangeWallRow(home.wallRows[WALL_MIX_ROW], mixWalls(packs, seed), packs);
  const homeRails = resolveHomeRails(rails, singles, categories, seed);
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
  const rows = {
    custom: <CustomRail />,
    festivals: festivalRails.map(({ f, items }) => (
      <LazyRail
        key={`festival-${f.id}`}
        eager
        title={`${f.name} · ${festivalShortDate(f)}`}
        href={festivalPages.includes(f.slug) ? `/${f.slug}` : `/stickers?q=${encodeURIComponent(f.tags[0] ?? f.name)}`}
      >
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </LazyRail>
    )),
    // The first two rails render straight away; the rest only when the shopper
    // scrolls near them.
    rails: homeRails.map((rail, i) => (
      <LazyRail key={rail.key} eager={Boolean(feedAt) || i < 2} title={rail.title} href={rail.href}>
        {rail.items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </LazyRail>
    )),
  };
  const isRow = (id: HomeSectionId): id is "festivals" | "rails" => id === "festivals" || id === "rails";
  const feed = (
    <WallFeed
      title={home.wallsTitle}
      walls={wallMix}
      themes={sectionOn("themes") ? wallRows : []}
      breaks={feedAt ? feedBreaks(order.slice(order.indexOf(feedAt) + 1).filter(isRow).flatMap((id) => Children.toArray(rows[id])), sectionOn("custom") && rows.custom) : []}
      seed={seed}
    />
  );

  const sections: Record<HomeSectionId, React.ReactNode> = {
    walls: feedAt ? feedAt === "walls" && feed : wallMix.length > 0 && (
      <LazyRail eager wide title={home.wallsTitle} href={categoryPath("poster-packs")}>
        {wallMix.map((product) => (
          <ProductCard key={product.id} product={product} width={WALL_CARD_WIDTH} wallEffect={wallEffect(0, seed)} />
        ))}
      </LazyRail>
    ),
    themes: feedAt ? feedAt === "themes" && feed : wallRows.map((row, i) => (
      <LazyRail key={row.id} eager={i < 1} wide title={row.title} href={`${categoryPath("poster-packs")}?theme=${row.id}`}>
        {row.items.map((product) => (
          <ProductCard key={product.id} product={product} width={WALL_CARD_WIDTH} wallEffect={wallEffect(i + 1, seed)} />
        ))}
      </LazyRail>
    )),
    ...rows,
  };

  return (
    <>
      {heroBanner}
      <div className="relative z-10 mt-2 space-y-1 pb-24 sm:space-y-8">
        {order
          .filter((id) => !feedAt || order.indexOf(id) <= order.indexOf(feedAt))
          .map((id) => (
            <Fragment key={id}>{sections[id]}</Fragment>
          ))}
      </div>
    </>
  );
}

/** Every wall set, one theme after another so none fills the row; a new order each day. */
function mixWalls(packs: Product[], seed: number): Product[] {
  const spin = (slug: string) => [...slug].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, seed >>> 0);
  const themeOf = (p: Product) => p.tags.find((t) => t.startsWith("wall theme:")) ?? "";
  const groups = new Map<string, Product[]>();
  for (const p of [...packs].sort((a, b) => spin(a.slug) - spin(b.slug))) {
    groups.set(themeOf(p), [...(groups.get(themeOf(p)) ?? []), p]);
  }
  const queues = [...groups.values()];
  const mix: Product[] = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) if (q.length) mix.push(q.shift()!);
  }
  return mix;
}
