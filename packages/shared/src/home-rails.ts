// Home page layout: an ordered list of product rails, edited in the admin.
// Browser-safe, no deps — the storefront resolves rails against the live
// (on-sale only) catalog, so hidden products never appear in any rail.
import { z } from "zod";
import type { Category, Product } from "./types";
import { categoryPath, inCategory } from "./utils";

export type HomeRailKind = "custom" | "featured" | "new" | "trending" | "category" | "categories";

export type HomeRail = {
  id: string;
  kind: HomeRailKind;
  /** Shown above the rail; for "category" an empty title uses the category name. */
  title: string;
  /** "category" rails only. */
  categoryId: string | null;
  /**
   * "custom" rails: the stickers, in this order. Other rails: pinned stickers
   * shown first (in this order), then the automatic ones fill the rest.
   * "categories": a pinned sticker leads its own category's rail.
   */
  productIds: string[];
  visible: boolean;
  /** Most stickers shown in the rail. */
  limit: number;
};

export const HOME_RAIL_KINDS: Record<HomeRailKind, { label: string; hint: string }> = {
  custom: { label: "Hand-picked", hint: "Stickers you choose, in your order" },
  featured: { label: "Top picks", hint: "Products marked Featured" },
  new: { label: "New drops", hint: "Newest stickers first" },
  trending: { label: "Trending now", hint: "Most viewed, saved, carted and bought in the last few days" },
  category: { label: "One category", hint: "Stickers from one category" },
  categories: { label: "All categories", hint: "A rail per category — stickers already shown above aren't repeated" },
};

export const DEFAULT_HOME_RAILS: HomeRail[] = [
  { id: "trending", kind: "trending", title: "Trending now", categoryId: null, productIds: [], visible: true, limit: 12 },
  { id: "top-picks", kind: "featured", title: "Top Picks This Week", categoryId: null, productIds: [], visible: true, limit: 10 },
  { id: "new-drops", kind: "new", title: "New Drops", categoryId: null, productIds: [], visible: true, limit: 10 },
  { id: "all-categories", kind: "categories", title: "", categoryId: null, productIds: [], visible: true, limit: 12 },
];

export const homeRailsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      kind: z.enum(["custom", "featured", "new", "trending", "category", "categories"]),
      title: z.string().trim().max(60),
      categoryId: z.string().nullable(),
      productIds: z.array(z.string()).max(40),
      visible: z.boolean(),
      limit: z.number().int().min(1).max(40),
    })
  )
  .max(30)
  .superRefine((rails, ctx) => {
    rails.forEach((rail, i) => {
      if (rail.kind === "category" && !rail.categoryId) {
        ctx.addIssue({ code: "custom", path: [i, "categoryId"], message: "Choose a category for each category rail" });
      }
      if ((rail.kind === "custom" || rail.kind === "featured" || rail.kind === "new" || rail.kind === "trending") && !rail.title) {
        ctx.addIssue({ code: "custom", path: [i, "title"], message: "Give every rail a title" });
      }
    });
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToHomeRails(value: any): HomeRail[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_RAILS;
  const parsed = homeRailsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_HOME_RAILS;
}

export type ResolvedRail = { key: string; title: string; href?: string; items: Product[]; kind?: HomeRailKind | "recent" | "for-you" | "with-cart" };

/** What makes the home page feel alive: what's hot, and what this shopper looked at. */
export type HomeBoost = {
  /** Trending score by product id (higher = hotter right now). */
  trend?: Map<string, number>;
  /** This shopper's category views (their own browser): category id → views. */
  interest?: Record<string, number>;
  /** Products this shopper opened, newest first. */
  recent?: string[];
  /** Products that go with what's in this shopper's cart, best first. */
  withCart?: Product[];
};

/** A rail with fewer cards than this after removing repeats is dropped. */
const MIN_RAIL = 3;

/**
 * Turns the layout into rails of products. `products` must be the on-sale
 * catalog, newest first. Hidden rails and rails with nothing to show are dropped.
 *
 * No product shows twice on the page: every rail fills itself only with
 * products no earlier rail has shown, nor anything in `exclude` (what the page
 * already shows above, e.g. festival rails). Pinned products keep their spot at
 * the front of the first rail that has them. A rail left with fewer than
 * MIN_RAIL cards is dropped.
 *
 * `seed` (a random number per visit, 0 = off) shuffles every automatic rail, so
 * each visit looks different. With `boost.trend` (what India searches now,
 * matched to products) the shuffle is weighted: matching products are far more
 * likely to come first, the rest still get a turn. "Trending now" leads (added
 * at the top when the layout has none), then for a returning shopper "Goes with
 * your cart", "Recently viewed" and "Picked for you" (their favourite categories), and the per-category rails come in the order this shopper and
 * everyone else are into, with a little chance mixed in.
 */
export function resolveHomeRails(
  rails: HomeRail[],
  products: Product[],
  categories: Category[],
  seed = 0,
  exclude: Iterable<string> = [],
  boost: HomeBoost = {}
): ResolvedRail[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const trend = boost.trend ?? new Map<string, number>();
  const top = Math.max(0, ...trend.values());
  const interest = boost.interest ?? {};
  const interestTotal = Object.values(interest).reduce((a, b) => a + b, 0);
  const explicitCategories = new Set(
    rails.filter((r) => r.visible && r.kind === "category" && r.categoryId).map((r) => r.categoryId)
  );
  const out: ResolvedRail[] = [];
  const shown = new Set<string>(exclude);
  const notShownYet = (p: Product) => !shown.has(p.id);
  /** 0..1 how hot a product is next to the hottest one. */
  const heat = (p: Product) => (top > 0 ? (trend.get(p.id) ?? 0) / top : 0);
  /** 0..1 how much this shopper looks at a product's categories. */
  const likes = (p: Product) =>
    interestTotal > 0 ? Math.min(1, (p.categoryIds ?? [p.categoryId]).reduce((n, id) => n + (id ? interest[id] ?? 0 : 0), 0) / interestTotal) : 0;
  // Same seed + rail → same order (stable while the visitor browses this tab, so Back looks the same).
  const mix = (list: Product[], salt: string) =>
    seed ? weightedShuffle(list, seed, salt, (p) => 1 + 5 * heat(p) + 1.5 * likes(p)) : list;
  // Pinned (on-sale) stickers first, then the automatic list; nothing an earlier rail showed.
  const pinnedFirst = (pins: string[], auto: Product[]) => {
    const pinned = pins.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
    const seen = new Set(pinned.map((p) => p.id));
    return [...pinned, ...auto.filter((p) => !seen.has(p.id))].filter(notShownYet);
  };
  const add = (key: string, title: string, href: string | undefined, items: Product[], kind?: ResolvedRail["kind"]) => {
    if (items.length < MIN_RAIL) return;
    items.forEach((p) => shown.add(p.id));
    out.push({ key, title, href, items, kind });
  };

  // Hottest first, a fresh order inside the hot set each visit. Before any
  // trend data exists: featured and new products, shuffled.
  const trendingItems = (limit: number, salt: string) => {
    // strong matches only (a word from one headline isn't a trend for that product)
    const hot = products.filter((p) => notShownYet(p) && heat(p) >= 0.35).sort((a, b) => trend.get(b.id)! - trend.get(a.id)!);
    const hotOrder = seed ? weightedShuffle(hot.slice(0, limit * 2), seed, salt, (p) => 4 * heat(p) ** 2) : hot;
    // topped up with featured and new products when the news has few matches
    const taken = new Set(hotOrder.map((p) => p.id));
    const fill = products.filter((p) => (p.featured || p.isNew) && notShownYet(p) && !taken.has(p.id));
    return [...hotOrder.slice(0, limit), ...(seed ? shuffled(fill, seed, salt) : fill)].slice(0, limit);
  };
  // The shopper's own rails, right after Trending.
  const personal = () => {
    add("with-cart", "Goes with your cart", undefined, (boost.withCart ?? []).filter(notShownYet).slice(0, 12), "with-cart");
    const recent = (boost.recent ?? []).map((id) => byId.get(id)).filter((p): p is Product => Boolean(p) && notShownYet(p!));
    add("recent", "Recently viewed", undefined, recent.slice(0, 12), "recent");
    if (interestTotal >= 3) {
      const favourite = Object.entries(interest).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
      const forYou = products.filter((p) => notShownYet(p) && favourite.some((id) => inCategory(p, id)));
      add("for-you", "Picked for you", undefined, mix(forYou, "for-you").slice(0, 12), "for-you");
    }
  };

  const layout = rails.some((r) => r.kind === "trending") ? rails : [DEFAULT_HOME_RAILS[0], ...rails];
  let personalDone = false;
  for (const rail of layout) {
    if (!rail.visible) continue;
    if (rail.kind === "categories") {
      // hot and favourite categories higher up, a bit of chance so the order moves
      const catHeat = (c: Category) => products.reduce((n, p) => n + (inCategory(p, c.id) ? trend.get(p.id) ?? 0 : 0), 0);
      const heats = new Map(categories.map((c) => [c.id, catHeat(c)]));
      const maxHeat = Math.max(1, ...heats.values());
      const order = seed
        ? weightedShuffle(categories, seed, `${rail.id}:order`, (c) => 1 + 3 * (heats.get(c.id)! / maxHeat) + (interestTotal ? 4 * (interest[c.id] ?? 0) / interestTotal : 0))
        : categories;
      for (const category of order) {
        if (explicitCategories.has(category.id)) continue;
        const inThis = (p: Product) => inCategory(p, category.id);
        const pins = rail.productIds.filter((id) => byId.get(id) && inThis(byId.get(id)!));
        const items = pinnedFirst(pins, mix(products.filter(inThis), category.id)).slice(0, rail.limit);
        add(`${rail.id}:${category.id}`, category.name, categoryPath(category.slug), items, "category");
      }
      continue;
    }
    let items: Product[] = [];
    let title = rail.title;
    let href: string | undefined;
    if (rail.kind === "trending") {
      items = pinnedFirst(rail.productIds, trendingItems(rail.limit, rail.id)).slice(0, rail.limit);
      add(rail.id, title || "Trending now", undefined, items, "trending");
      if (!personalDone) personal();
      personalDone = true;
      continue;
    }
    if (rail.kind === "featured") items = mix(products.filter((p) => p.featured), rail.id);
    else if (rail.kind === "new") {
      // still the newest stickers (of those not shown above), just not always in the same order
      items = mix(products.filter(notShownYet).slice(0, rail.limit), rail.id);
      href = "/stickers?sort=new";
    } else if (rail.kind === "category") {
      const category = rail.categoryId ? catById.get(rail.categoryId) : undefined;
      if (!category) continue;
      items = mix(products.filter((p) => inCategory(p, category.id)), rail.id);
      title = title || category.name;
      href = categoryPath(category.slug);
    }
    items = pinnedFirst(rail.productIds, rail.kind === "custom" ? [] : items).slice(0, rail.limit);
    add(rail.id, title, href, items, rail.kind);
  }
  return out;
}

/**
 * Weighted random order (Efraimidis–Spirakis): each item draws u^(1/w), biggest
 * first, so an item with twice the weight is about twice as likely to come
 * before another. Deterministic from the seed and a per-rail salt.
 */
function weightedShuffle<T>(list: T[], seed: number, salt: string, weight: (item: T) => number): T[] {
  const rand = rng(seed, salt);
  return list
    .map((item) => ({ item, key: Math.pow(rand() || 1e-9, 1 / Math.max(weight(item), 0.01)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}

function rng(seed: number, salt: string): () => number {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 2654435761) >>> 0;
  return () => {
    // mulberry32
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher–Yates shuffle from a seed and a per-rail salt. */
function shuffled<T>(list: T[], seed: number, salt: string): T[] {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 2654435761) >>> 0;
  const rand = () => {
    // mulberry32
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
