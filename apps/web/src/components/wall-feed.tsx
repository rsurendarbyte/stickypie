"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { categoryPath, resolveHomeRails, type Category, type Product } from "@stickypie/shared";
import { isPosterPack } from "@/lib/poster";
import { useHomePage, useHomeRails } from "@/lib/live-catalog";
import { rememberChoice, savedChoice, useRailScrollMemory } from "@/lib/scroll-memory";
import { wallEffect } from "@/lib/wall-effects";
import CustomRail from "./custom-rail";
import LazyRail from "./lazy-rail";
import ProductCard from "./product-card";
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

/** The blocks to put between walls: the AI row first and again every few, the others in order. */
export function feedBreaks(rows: React.ReactNode[], ai: React.ReactNode): React.ReactNode[] {
  if (!ai) return rows;
  const out: React.ReactNode[] = [];
  rows.forEach((row, i) => {
    if (i % AI_EVERY === 0) out.push(ai);
    out.push(row);
  });
  return out.length ? out : [ai];
}

/** Every wall, full width, with the shop's other blocks between; only what's near the screen is drawn. */
function WallPosts({
  walls,
  breaks,
  seed,
  leftovers,
}: {
  walls: Product[];
  breaks: React.ReactNode[];
  seed: number;
  /** Show the blocks the posts didn't reach after the last post. */
  leftovers: boolean;
}) {
  const items = useMemo(() => {
    const out: FeedItem[] = [];
    // Same as the rail cards' width. Every row holds this height, so Back lands on the same post.
    const rowHeight = Math.round(Math.min(window.innerWidth * 0.6, 240) * 1.25) + ROW_TEXT;
    const block = (i: number): FeedItem => ({
      key: `block-${i}`,
      height: rowHeight + GAP,
      render: () => (
        <div className="pb-3">
          <div style={{ minHeight: rowHeight }}>{breaks[i]}</div>
        </div>
      ),
    });
    const postHeight = window.innerWidth - 32 + POST_TEXT + GAP;
    walls.forEach((product, i) => {
      out.push({
        key: product.id,
        height: postHeight,
        render: () => (
          <div className="px-4 pb-3">
            <ProductCard product={product} width="w-full" wallEffect={wallEffect(i, seed)} />
          </div>
        ),
      });
      const at = (i + 1) / POSTS_PER_BREAK - 1;
      if (Number.isInteger(at) && at < breaks.length) out.push(block(at));
    });
    if (leftovers) {
      for (let i = Math.floor(walls.length / POSTS_PER_BREAK); i < breaks.length; i++) out.push(block(i));
    }
    return out;
  }, [walls, breaks, seed, leftovers]);
  return <VirtualFeed items={items} />;
}

/** Phones, home page: the wall feed, with chips that narrow it to a theme. */
export default function WallFeed({
  title,
  walls,
  themes,
  breaks,
  seed,
}: {
  title: string;
  walls: Product[];
  themes: { id: string; title: string; items: Product[] }[];
  breaks: React.ReactNode[];
  seed: number;
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
        <WallPosts walls={items} breaks={breaks} seed={seed} leftovers />
      </div>
    </section>
  );
}

/** Phones, Walls page: the same feed under the page's own title and chips. */
export function WallsPageFeed({
  walls,
  products,
  categories,
  seed,
  plain,
}: {
  walls: Product[];
  products: Product[];
  categories: Category[];
  seed: number;
  /** Search results: only the walls. */
  plain: boolean;
}) {
  const home = useHomePage();
  const { rails } = useHomeRails([]);
  const breaks = useMemo(() => {
    if (plain) return [];
    const on = (id: string) => home.sections.some((s) => s.id === id && s.visible);
    const singles = products.filter((p) => !isPosterPack(p));
    const rows = on("rails")
      ? resolveHomeRails(rails, singles, categories, seed).map((rail) => (
          <LazyRail key={rail.key} eager title={rail.title} href={rail.href}>
            {rail.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </LazyRail>
        ))
      : [];
    return feedBreaks(rows, on("custom") ? <CustomRail /> : null);
  }, [plain, home.sections, rails, products, categories, seed]);
  return (
    <div className="mt-3 -mx-4">
      <WallPosts walls={walls} breaks={breaks} seed={seed} leftovers={false} />
    </div>
  );
}
