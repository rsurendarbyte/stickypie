"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import Hero from "./hero";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import Row from "./row";
import CustomRail from "./custom-rail";
import { resolveHomeRails, type HomeRail } from "@stickypie/shared";
import { useHomeRails, useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
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
  // Rails, their order and contents come from the admin (Home page).
  const homeRails = resolveHomeRails(rails, products, categories);
  const newDrops = homeRails.findIndex((r) => r.key === "new-drops");
  const customAfter = newDrops >= 0 ? newDrops : Math.min(1, homeRails.length - 1);

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
        {homeRails.map((rail, i) => (
          // The first two rails render straight away; the rest only when the
          // shopper scrolls near them.
          <Fragment key={rail.key}>
            <LazyRail eager={i < 2} title={rail.title} href={rail.href}>
              {rail.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </LazyRail>
            {/* "Make your own" sits right after New Drops (or after the 2nd rail) */}
            {i === customAfter && <CustomRail />}
          </Fragment>
        ))}
      </div>
    </>
  );
}

/**
 * A home rail that renders its cards only once it's near the screen; until
 * then it shows its title and a few skeleton cards of the same height.
 */
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
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    const MARGIN = 700;
    const show = () => setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), {
      rootMargin: `${MARGIN}px 0px`,
    });
    io.observe(el);
    // Backup for in-app browsers (e.g. Instagram) that hold observers back.
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight + MARGIN && r.bottom > -MARGIN) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [near]);

  return (
    <div ref={box}>
      <Row title={title} href={href}>
        {near ? children : Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} index={i} />)}
      </Row>
    </div>
  );
}
