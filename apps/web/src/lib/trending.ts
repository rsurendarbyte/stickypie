"use client";

// What India is searching right now (global_trends: Google Trends India, kept
// fresh hourly by the database), matched against our catalog in the browser.
// Our own traffic is too small to say what's hot, so this is the world's.
// Free-plan friendly: no Worker request at all (straight to Supabase REST), at
// most one small read an hour per browser (kept in localStorage), and only the
// newest 80 terms with the names from their headlines (a few KB). Matching runs
// once per page over a word index. When the read fails (or the table isn't
// there yet) the page simply works without it.
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { Category, Product } from "@stickypie/shared";
import { liveCatalogEnabled } from "./live-catalog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = "stickypie.trends:v1";
const TTL_MS = 60 * 60_000;

type TrendRow = { term: string; source: string; traffic: number; key_names: string[]; names: string[]; seen_at: string };
/** Per product: how hot (higher = hotter) and the search it matched. */
export type Trend = Map<string, { score: number; topic: string }>;

let rows: TrendRow[] = [];
let loaded = false;
let started = false;
const listeners = new Set<() => void>();
const EMPTY: TrendRow[] = [];

function settle(next: TrendRow[] | null) {
  if (next && !loaded) rows = next;
  loaded = true;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!liveCatalogEnabled) return settle(null);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && Date.now() - saved.at < TTL_MS && Array.isArray(saved.rows)) return settle(saved.rows);
  } catch {
    // storage off: ask
  }
  // never hold the rows up for long
  const late = setTimeout(() => settle(null), 2500);
  fetch(`${SUPABASE_URL}/rest/v1/global_trends?select=term,source,traffic,key_names,names,seen_at&order=seen_at.desc&limit=80`, {
    headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((got: TrendRow[] | null) => {
      clearTimeout(late);
      if (Array.isArray(got)) {
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rows: got }));
        } catch {
          // fine
        }
      }
      settle(Array.isArray(got) ? got : null);
    })
    .catch(() => {
      clearTimeout(late);
      settle(null);
    });
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

// Words that say nothing about a poster (headlines are full of them, in Title Case).
const STOP = new Set(
  "the and for with from this that what when where will have after over into about news live today latest update updates video photos watch know full list price launch launched india indian says said vs match score team first year years new old day days time week report how why who are was were has its out off big top best more most all can not one two three ipl cup rip video videos report reports when why prime home homes every record records entries draws watch january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday official trailer teaser movie movies film films cinema series episode song songs review reviews release date box office collection car cars bike bikes laptop bottle helmet fridge wall walls poster posters mini sticker stickers art decal pack set".split(" "),
);

/** Latin words of 4+ letters (3+ when Capitalised, like "Iyer"), lowercased. */
function words(text: string, properOnly: boolean): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9]+/g)) {
    const w = m[0];
    const proper = /^[A-Z]/.test(w) && !(m.index === 0);
    if (properOnly && !proper) continue;
    if (w.length < (proper ? 3 : 4)) continue;
    const l = w.toLowerCase();
    if (!STOP.has(l)) out.push(l);
  }
  return out;
}

/** Scores every product against the current searches: bigger, newer searches count more. */
export function matchTrends(trendRows: TrendRow[], products: Product[], categories: Category[]): Trend {
  const catNames = new Map(categories.map((c) => [c.id, c.name]));
  // word → products that carry it (name, tags, category names), built once
  const index = new Map<string, number[]>();
  products.forEach((p, i) => {
    const text = [p.name, ...p.tags, ...(p.categoryIds ?? [p.categoryId]).map((id) => (id ? catNames.get(id) ?? "" : ""))].join(" ").toLowerCase();
    for (const w of new Set(text.match(/[a-z0-9]{3,}/g) ?? [])) {
      if (STOP.has(w)) continue;
      const list = index.get(w);
      if (list) list.push(i);
      else index.set(w, [i]);
    }
  });
  const vocab = [...index.keys()].filter((w) => w.length >= 5);
  // Same word, or one a 5+ letter start of the other ("rajini" ~ "rajinikanth"); cached per word.
  const memo = new Map<string, number[]>();
  const productsFor = (w: string): number[] => {
    let got = memo.get(w);
    if (got) return got;
    const set = new Set(index.get(w) ?? []);
    if (w.length >= 5) for (const v of vocab) if (v !== w && (v.startsWith(w) || w.startsWith(v))) index.get(v)!.forEach((i) => set.add(i));
    got = [...set];
    memo.set(w, got);
    return got;
  };
  const now = Date.now();
  const score = new Float64Array(products.length);
  const best = new Array<{ topic: string; s: number }>(products.length);
  for (const r of trendRows) {
    const ageDays = Math.max(0, (now - Date.parse(r.seen_at)) / 86_400_000);
    const weight = (r.source === "manual" ? 3 : 1) * Math.log10(10 + (r.traffic || 0)) * Math.pow(0.6, ageDays);
    // the trend's own words count fully, names in 2+ of its headlines a good
    // part, a word from just one headline only a little
    const own = new Set(words(r.term, false));
    const clean = (list: string[] | undefined) => (list ?? []).filter((w) => w.length >= 3 && !STOP.has(w) && !own.has(w));
    const local = new Map<number, number>();
    const give = (w: string, part: number) => {
      const list = productsFor(w);
      // a word half the catalog carries ("tamil", "super") says little about any one product
      const rare = Math.min(1, 25 / Math.max(list.length, 1));
      for (const i of list) local.set(i, (local.get(i) ?? 0) + part * rare);
    };
    for (const w of own) give(w, 1);
    for (const w of clean(r.key_names)) give(w, 0.6);
    for (const w of clean(r.names)) give(w, 0.2);
    for (const [i, n] of local) {
      const s = weight * n;
      score[i] += s;
      if (!best[i] || s > best[i].s) best[i] = { topic: r.term, s };
    }
  }
  const out: Trend = new Map();
  products.forEach((p, i) => score[i] > 0 && out.set(p.id, { score: score[i], topic: best[i].topic }));
  return out;
}

/** Products matching what India searches now, and whether the answer is in (or given up on). */
export function useTrending(products: Product[], categories: Category[]): { trend: Trend; loaded: boolean } {
  const r = useSyncExternalStore(subscribe, () => rows, () => EMPTY);
  const l = useSyncExternalStore(subscribe, () => loaded, () => false);
  const trend = useMemo(() => (r.length ? matchTrends(r, products, categories) : (new Map() as Trend)), [r, products, categories]);
  return { trend, loaded: l };
}

/** How many of the best matches get the "Trending" tag on their card. */
export const HOT_TAGS = 10;

/** The hottest products (ids), for the card tag; empty outside the home page. */
export const HotContext = createContext<Set<string>>(new Set());

export function useIsHot(id: string): boolean {
  return useContext(HotContext).has(id);
}

/** Products this browser opened, newest first (the view counter's own list; ids only). */
export function recentlyViewedIds(): string[] {
  try {
    const looks: Record<string, string> = JSON.parse(localStorage.getItem("stickypie.looks") || "{}");
    return Object.keys(looks).reverse();
  } catch {
    return [];
  }
}
