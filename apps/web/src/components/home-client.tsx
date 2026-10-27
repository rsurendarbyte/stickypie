"use client";

import Link from "@/components/page-link";
import { Children, Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Hero from "./hero";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import Row from "./row";
import CustomRail from "./custom-rail";
import { resolveHomeRails, type HomeRail } from "@stickypie/shared";
import { useHomeRails, useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { savedRailScroll, useWindowScrollMemory } from "@/lib/scroll-memory";
import { useSkinSeed } from "@/lib/skin-seed";
import StickerLoader from "./sticker-loader";

export default function HomeClient({
  initial,
  initialRails,
}: {
  initial: Catalog;
  initialRails: HomeRail[];
}) {
  const catalog = useLiveCatalog(initial);
  const { rails, loaded: railsLoaded } = useHomeRails(initialRails);
  const { categories, products, failed, retry } = catalog;
  const loaded = catalog.loaded && railsLoaded;
  useWindowScrollMemory(loaded);

  const featured = products.filter((p) => p.featured);
  const hero = featured[0] ?? products[0];
  // Rails and their order come from the admin (Home page); what each rail
  // shows is shuffled once per visit in the browser, so the page feels fresh.
  const seed = useSkinSeed();
  const homeRails = resolveHomeRails(rails, products, categories, seed);

  // Placeholders until the live (on-sale only) list arrives — never stale cards.
  if (!loaded) {
    return (
      <div aria-busy="true" aria-label="Loading stickers">
        <div className="w-full px-4 pt-24 sm:px-8 lg:px-12 2xl:px-20">
          <div className="grid h-[48vh] min-h-[320px] place-items-center rounded-3xl bg-ink2">
            <StickerLoader size={88} label="Peeling fresh stickers…" />
          </div>
        </div>
        <div className="mt-8 space-y-10 pb-24">
          {["Top Picks This Week", "New Drops"].map((title) => (
            <Row key={title} title={title}>
              {Array.from({ length: 6 }, (_, i) => (
                <ProductCardSkeleton key={i} index={i} />
              ))}
            </Row>
          ))}
        </div>
      </div>
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

  return (
    <>
      <Hero products={featured.length > 0 ? featured : [hero]} categories={categories} />
      <div className="relative z-10 mt-2 space-y-10 pb-24">
        {/* "Make your own" (led by the AI avatar styles) is the first row */}
        <CustomRail />
        {homeRails.map((rail, i) => (
          // The first two rails render straight away; the rest only when the
          // shopper scrolls near them.
          <Fragment key={rail.key}>
            <LazyRail eager={i < 2} title={rail.title} href={rail.href}>
              {rail.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </LazyRail>
          </Fragment>
        ))}
      </div>
    </>
  );
}

/**
 * A home rail that renders its cards only once it's near the screen; until
 * then it shows its title and a few plain card-sized blocks (no animation).
 * Once drawn, it holds only the cards that fit plus a few more, and adds more
 * as the shopper swipes along it — a rail of 30 isn't 30 cards in the page.
 */
const RAIL_STEP = 6;

function LazyRail({
  eager,
  title,
  href,
  children,
}: {
  eager: boolean;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const cards = Children.toArray(children);
  const [shown, setShown] = useState(RAIL_STEP + 2);
  // While put away: the rail's height (held, so nothing below it moves — iOS
  // has no scroll anchoring) and how far it had been swiped.
  const away = useRef<{ height: number; left: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Drawn when within SHOW of the screen; put back to plain blocks when
    // further than HIDE — so only the rails around the screen hold cards.
    const SHOW = 700;
    const HIDE = 1600;
    const set = (next: boolean) =>
      setNear((was) => {
        if (was && !next) {
          const scroller = el.querySelector<HTMLElement>(".rail-scroller");
          away.current = { height: el.offsetHeight, left: scroller?.scrollLeft ?? 0 };
        }
        return next;
      });
    const show = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && set(true), {
      rootMargin: `${SHOW}px 0px`,
    });
    const hide = new IntersectionObserver((e) => e.every((x) => !x.isIntersecting) && set(false), {
      rootMargin: `${HIDE}px 0px`,
    });
    show.observe(el);
    hide.observe(el);
    // Backup for in-app browsers (e.g. Instagram) that hold observers back.
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const off = Math.max(r.top - window.innerHeight, -r.bottom, 0);
        if (off < SHOW) set(true);
        else if (off > HIDE) set(false);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      show.disconnect();
      hide.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Back near the screen: put the swipe back where it was.
  useLayoutEffect(() => {
    if (!near || !away.current) return;
    const scroller = box.current?.querySelector<HTMLElement>(".rail-scroller");
    if (scroller) scroller.scrollLeft = away.current.left;
    away.current = null;
  }, [near]);

  // Wide screens see more cards at once: start with a screenful plus a few —
  // and on a back visit, enough to reach where the shopper had swiped to.
  useEffect(() => {
    const back = savedRailScroll(title) ?? 0;
    setShown((n) => Math.max(n, Math.ceil((back + window.innerWidth) / 170) + 3));
  }, [title]);

  // Swiped near the end of what's drawn: draw the next few.
  useEffect(() => {
    const el = box.current;
    if (!near || !el || shown >= cards.length) return;
    const onScroll = (e: Event) => {
      const s = e.target as HTMLElement;
      if (!s.classList?.contains("rail-scroller")) return;
      if (s.scrollLeft + s.clientWidth * 2 > s.scrollWidth) setShown((n) => n + RAIL_STEP);
    };
    el.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => el.removeEventListener("scroll", onScroll, { capture: true });
  }, [near, shown, cards.length]);

  return (
    <div ref={box} style={{ minHeight: !near && away.current ? away.current.height : undefined }}>
      <Row title={title} href={href}>
        {near
          ? cards.slice(0, shown)
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} aria-hidden className="w-44 shrink-0 overflow-hidden rounded-2xl border border-line bg-ink sm:w-48 md:w-52">
                <div className="aspect-[4/5] bg-ink2" />
                <div className="h-[100px]" />
              </div>
            ))}
      </Row>
    </div>
  );
}
