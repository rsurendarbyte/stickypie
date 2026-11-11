"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { categoryPath, resolveHomeRails, type Category, type Product } from "@stickypie/shared";
import { SINGLE_POSTERS, isListed, isPosterPack } from "@/lib/poster";
import { useHomePage, useHomeRails } from "@/lib/live-catalog";
import { rememberChoice, savedChoice, useRailScrollMemory } from "@/lib/scroll-memory";
import { wallEffect } from "@/lib/wall-effects";
import CustomRail from "./custom-rail";
import LazyRail from "./lazy-rail";
import ProductCard from "./product-card";
import { usePuzzleLead } from "@/lib/puzzle-mix";
import { RowHead } from "./row";
import VirtualFeed, { type FeedItem } from "./virtual-feed";

const PHONE = "(max-width: 639px)";

/** True on phone widths. False on the server, so the page never ships the feed in its static shell. */
export function usePhone() {
  return useSyncExternalStore(
    (changed) => {
      const screen = window.matchMedia(PHONE);
      screen.addEventListener("change", changed);
      return () => screen.removeEventListener("change", changed);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/** Another block of the shop after this many posts, so walls aren't all there is. */
const POSTS_PER_BREAK = 4;
/** The AI and custom makers come back after this many other blocks. */
const AI_EVERY = 2;
/** Below the nav bar. */
const NAV_HEIGHT = 60;
const THEME_KEY = "wall-feed-theme";
/** Text and buttons under a post's square picture. */
const POST_TEXT = 118;
const GAP = 12;
/** A rail's title, text and buttons, apart from its 4:5 card pictures. */
const ROW_TEXT = 205;

/** A wall theme chip's colours, on home and on the Walls page. */
export const wallChipColours = (on: boolean) =>
  on ? "border-brand bg-brand/[0.07] text-brand" : "border-line bg-white text-fog hover:text-snow";

/**
 * A block between the walls: ready to draw, or built when the feed reaches it,
 * from the products the page has shown so far (`used`), so its puzzle cards
 * pick in the order the shopper scrolls.
 */
export type FeedBreak = React.ReactNode | ((used: Set<string>) => React.ReactNode);

/** The blocks to put between walls: the AI row first and again every few, the others in order. */
export function feedBreaks(rows: FeedBreak[], ai: React.ReactNode): FeedBreak[] {
  if (!ai) return rows;
  const out: FeedBreak[] = [];
  rows.forEach((row, i) => {
    if (i % AI_EVERY === 0) out.push(ai);
    out.push(row);
  });
  return out.length ? out : [ai];
}

/** Walls taken this many at a time, with a puzzle card before each group (the same pattern as one long row). */
const WALLS_PER_PUZZLE = 2;

/** Every wall, full width, with the shop's other blocks between; only what's near the screen is drawn. */
function WallPosts({
  walls,
  breaks,
  seed,
  leftovers,
  used,
}: {
  walls: Product[];
  breaks: FeedBreak[];
  seed: number;
  /** Products the page shows as cards anywhere: puzzle cards skip them until every poster has been shown once. */
  used?: Set<string>;
  /** Show the blocks the posts didn't reach after the last post. */
  leftovers: boolean;
}) {
  // puzzle poster cards first and between the walls, in the wall card's shape
  const lead = usePuzzleLead();
  const items = useMemo(() => {
    // a copy, filled with the puzzle picks top to bottom: the feed's walls and
    // its rows pick in the order they're seen, so the first repeat comes only
    // after every poster has been shown
    const shown = new Set(used ?? []);
    const out: FeedItem[] = [];
    // Same as the rail cards' width. Every row holds this height, so Back lands on the same post.
    const rowHeight = Math.round(Math.min(window.innerWidth * 0.6, 240) * 1.25) + ROW_TEXT;
    let b = 0;
    const block = () => {
      const i = b++;
      const made = breaks[i];
      const node = typeof made === "function" ? made(shown) : made;
      out.push({
        key: `block-${i}`,
        height: rowHeight + GAP,
        render: () => (
          <div className="pb-3">
            <div style={{ minHeight: rowHeight }}>{node}</div>
          </div>
        ),
      });
    };
    const postHeight = window.innerWidth - 32 + POST_TEXT + GAP;
    let n = 0;
    for (let c = 0; c < walls.length; c += WALLS_PER_PUZZLE) {
      for (const product of lead(walls.slice(c, c + WALLS_PER_PUZZLE), { used: shown })) {
        const i = n++;
        out.push({
          key: `${product.id}:${i}`,
          height: postHeight,
          render: () => (
            <div className="px-4 pb-3">
              <ProductCard product={product} width="w-full" wallEffect={wallEffect(i, seed)} />
            </div>
          ),
        });
        if (n % POSTS_PER_BREAK === 0 && b < breaks.length) block();
      }
    }
    if (leftovers) while (b < breaks.length) block();
    return out;
  }, [lead, walls, breaks, used, seed, leftovers]);
  return <VirtualFeed items={items} />;
}

/** Phones, home page: the wall feed, with chips that narrow it to a theme. */
export default function WallFeed({
  title,
  walls,
  themes,
  breaks,
  seed,
  used,
}: {
  title: string;
  walls: Product[];
  themes: { id: string; title: string; items: Product[] }[];
  breaks: FeedBreak[];
  seed: number;
  used?: Set<string>;
}) {
  const [theme, setTheme] = useState(() => {
    const saved = savedChoice(THEME_KEY);
    if (saved === null) rememberChoice(THEME_KEY, ""); // a fresh visit starts on All
    return themes.some((t) => t.id === saved) ? saved : null;
  });
  const bar = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useRailScrollMemory(chips, THEME_KEY, themes.length);

  const items = themes.find((t) => t.id === theme)?.items ?? walls;
  const href = theme ? `${categoryPath("poster-packs")}?theme=${theme}` : categoryPath("poster-packs");

  function pick(id: string | null, button: HTMLElement) {
    setTheme(id);
    // The picked chip comes to the middle, so its neighbours show which way there's more.
    chips.current?.scrollTo({ left: button.offsetLeft - (chips.current.clientWidth - button.offsetWidth) / 2, behavior: "smooth" });
    rememberChoice(THEME_KEY, id ?? "");
    // Further down the feed: back to its first post, just under the chips.
    requestAnimationFrame(() => {
      const top = list.current?.getBoundingClientRect().top;
      const height = bar.current?.offsetHeight ?? 0;
      if (top !== undefined && top < NAV_HEIGHT + height) {
        window.scrollBy({ top: top - NAV_HEIGHT - height, behavior: "instant" as ScrollBehavior });
      }
    });
  }

  const chip = (on: boolean) =>
    `h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${wallChipColours(on)}`;

  return (
    <section>
      <RowHead title={title} href={href} />
      {themes.length > 0 && (
        <div ref={bar} className="sticky top-[60px] z-20 mt-1 bg-white shadow-[0_6px_10px_-8px_rgba(16,24,40,0.18)]">
          <div ref={chips} className="no-scrollbar relative flex gap-1.5 overflow-x-auto px-4 py-2">
            <button type="button" aria-pressed={!theme} onClick={(e) => pick(null, e.currentTarget)} className={chip(!theme)}>
              All
            </button>
            {themes.map((t) => (
              <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={(e) => pick(t.id, e.currentTarget)} className={chip(theme === t.id)}>
                {t.title.replace(/\s+walls?$/i, "")}
              </button>
            ))}
          </div>
          {/* the chips fade out at the edge: there's more to swipe to */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />
        </div>
      )}
      <div ref={list} className="mt-2">
        <WallPosts walls={items} breaks={breaks} seed={seed} leftovers used={used} />
      </div>
    </section>
  );
}

/** Single posters between the walls of the Walls page; the rest are one chip or tap away. */
export function SinglePostersRail({ posters, mixed }: { posters: Product[]; /** Already mixed with puzzle cards (the phone feed does it). */ mixed?: boolean }) {
  // a puzzle poster card first
  const mix = usePuzzleLead();
  return (
    <LazyRail eager title="Single posters" href={`${categoryPath("poster-packs")}?theme=${SINGLE_POSTERS}`}>
      {(mixed ? posters : mix(posters.slice(0, 24))).map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </LazyRail>
  );
}

/** Phones, Walls page: the same feed under the page's own title and chips. */
export function WallsPageFeed({
  walls,
  products,
  categories,
  seed,
  plain,
  singles: singlesFirst,
}: {
  walls: Product[];
  products: Product[];
  categories: Category[];
  seed: number;
  /** Search results: only the walls. */
  plain: boolean;
  /** Single posters: a row of them comes before the other blocks. */
  singles?: Product[];
}) {
  const home = useHomePage();
  const { rails } = useHomeRails([]);
  const mix = usePuzzleLead();
  // Every product the page shows as a card, so no product (or its puzzle card)
  // comes twice until every poster has been shown once; the rows' puzzle cards
  // are picked when the feed reaches them.
  const { breaks, used } = useMemo(() => {
    const used = new Set<string>(walls.map((p) => p.id));
    if (plain) return { breaks: [] as FeedBreak[], used };
    const on = (id: string) => home.sections.some((s) => s.id === id && s.visible);
    const firstRow = singlesFirst?.length ? singlesFirst.slice(0, 24) : [];
    firstRow.forEach((p) => used.add(p.id));
    const singles = products.filter((p) => !isPosterPack(p) && isListed(p));
    const resolved = on("rails") ? resolveHomeRails(rails, singles, categories, seed, used) : [];
    resolved.forEach((rail) => rail.items.forEach((p) => used.add(p.id)));
    const first: FeedBreak[] = firstRow.length ? [(shown: Set<string>) => <SinglePostersRail posters={mix(firstRow, { used: shown })} mixed />] : [];
    const rows: FeedBreak[] = resolved.map((rail) => (shown: Set<string>) => (
      <LazyRail key={rail.key} eager title={rail.title} href={rail.href}>
        {mix(rail.items, { used: shown }).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </LazyRail>
    ));
    return { breaks: [...first, ...feedBreaks(rows, on("custom") ? <CustomRail /> : null)], used };
  }, [plain, singlesFirst, walls, home.sections, rails, products, categories, seed, mix]);
  return (
    <div className="mt-3 -mx-4">
      <WallPosts walls={walls} breaks={breaks} seed={seed} leftovers={false} used={used} />
    </div>
  );
}
