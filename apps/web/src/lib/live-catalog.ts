"use client";

// Live catalog over the Supabase REST API, straight from the browser — with
// as few requests as possible:
//
//   1. ONE small row (store_settings: prices, shipping settings, home layout,
//      features and `catalog_version`), re-checked on every page load so admin
//      edits (e.g. a new price) show on the shopper's next page. The last copy
//      is kept in localStorage and shown at once while it's re-checked.
//   2. The full catalog (categories + on-sale products) is kept in IndexedDB
//      and only re-downloaded when `catalog_version` changed — the database
//      bumps it whenever the admin edits a product/category/setting or stock
//      moves after a sale. So everyone sees admin changes on their next page
//      load, and nobody re-downloads an unchanged catalog.
//   3. Within one page, every hook shares the in-memory copy; product pages and
//      "More like this" read from it instead of asking the API again.
//   So a page load costs one small request; admin changes reach shoppers on
//   their next page load (checkout re-checks prices and stock on the server
//   anyway).
//
// RLS only exposes is_active products, so items taken off sale never reach the
// browser. Demo mode (no Supabase env) keeps the server-rendered data.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Category, FeatureFlags, Festival, HomePage, HomeRail, Product, PublicReview, StoreSettings } from "@stickypie/shared";
import {
  DEFAULT_FEATURES,
  DEFAULT_HOME_PAGE,
  DEFAULT_STORE_SETTINGS,
  inCategory,
  rowToCategory,
  rowToFeatures,
  rowToFestivals,
  rowToHomePage,
  rowToHomeRails,
  rowToProduct,
  rowToPublicReview,
  rowToSettings,
} from "@stickypie/shared";
import { idbGet, idbSet } from "./idb";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const liveCatalogEnabled = Boolean(SUPABASE_URL && ANON_KEY);

/** Bump when the cached shape changes so old caches are ignored. */
const CACHE_KEY = "catalog:v2";
const MEMORY_TTL_MS = 60_000;
const META_KEY = "store-settings:v1";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function rest(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase REST error ${res.status}`);
  return res.json();
}

export type Catalog = { categories: Category[]; products: Product[] };

type Bundle = Catalog & {
  version: string;
  settings: StoreSettings;
  rails: HomeRail[];
  festivals: Festival[];
  features: FeatureFlags;
  homePage: HomePage;
  reviews: PublicReview[];
  /** Settings checked with the database on this page load (not just the saved copy). */
  fresh: boolean;
};
type CachedCatalog = Catalog & { version: string; reviews: PublicReview[] };

let memory: { bundle: Bundle; at: number } | null = null;
let inflight: Promise<Bundle> | null = null;
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

function freshMemory(): Bundle | null {
  return memory && Date.now() - memory.at < MEMORY_TTL_MS ? memory.bundle : null;
}

/** The store_settings row saved by an earlier page load (any age). */
function savedMeta(): { meta: any; at: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(META_KEY) ?? "null");
    return saved?.meta ? saved : null;
  } catch {
    return null; // storage blocked (private mode) or bad JSON: just ask again
  }
}

function saveMeta(meta: any) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ meta, at: Date.now() }));
  } catch {
    // storage full or blocked: the next page simply asks again
  }
}

async function fetchMeta(): Promise<any | null> {
  const [meta] = await rest("store_settings?select=*&id=eq.1");
  if (meta) saveMeta(meta);
  return meta ?? null;
}

async function fetchCatalog(): Promise<CachedCatalog> {
  const [categoryRows, productRows, reviewRows] = await Promise.all([
    rest("categories?select=*&order=sort.asc,name.asc"),
    rest("products?select=*&is_active=eq.true&order=created_at.desc"),
    // Approved reviews only (public view). Missing view → no reviews.
    rest("product_reviews_public?select=*&order=created_at.desc&limit=1000").catch(() => []),
  ]);
  return {
    version: "",
    categories: categoryRows.map(rowToCategory),
    products: productRows.map(rowToProduct),
    reviews: reviewRows.map(rowToPublicReview),
  };
}

/** Hands a catalog + settings to every hook on the page. */
function publish(meta: any, catalog: CachedCatalog, fresh = true): Bundle {
  const bundle: Bundle = {
    ...catalog,
    fresh,
    settings: rowToSettings(meta),
    rails: rowToHomeRails(meta?.home_rails),
    festivals: rowToFestivals(meta?.festivals),
    features: rowToFeatures(meta?.features),
    homePage: rowToHomePage(meta?.features?.homePage),
  };
  memory = { bundle, at: Date.now() };
  listeners.forEach((notify) => notify());
  return bundle;
}

/**
 * Never makes the shopper wait for the network when anything is saved:
 *   - saved settings + catalog → shown at once, then the settings row is
 *     re-checked and swapped in place if the admin changed anything (the
 *     catalog is only re-downloaded when its version moved);
 *   - nothing saved (first visit) → settings and catalog asked for together,
 *     not one after the other.
 */
function loadCatalog(): Promise<Bundle> {
  const hit = freshMemory();
  if (hit) return Promise.resolve(hit);
  inflight ??= (async () => {
    const saved = savedMeta();
    const cached = await idbGet<CachedCatalog>(CACHE_KEY);

    // show the last copy at once; the fresh settings below replace it
    if (saved && cached && !memory) publish(saved.meta, cached, false);

    if (!cached) {
      const [meta, catalog] = await Promise.all([fetchMeta(), fetchCatalog()]);
      const version: string | null = meta?.catalog_version ?? null;
      if (version) void idbSet(CACHE_KEY, { ...catalog, version });
      return publish(meta, { ...catalog, version: version ?? "" });
    }

    const meta = await fetchMeta();
    const version: string | null = meta?.catalog_version ?? null;
    if (version && cached.version === version) return publish(meta, cached);
    const catalog = { ...(await fetchCatalog()), version: version ?? "" };
    if (version) void idbSet(CACHE_KEY, catalog);
    return publish(meta, catalog);
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Shared state for every hook below — one load per page, however many hooks.
 * useSyncExternalStore renders `null` while hydrating the static HTML (which
 * has placeholders), so an already-loaded catalog never causes a hydration
 * mismatch; client-side navigation gets the in-memory catalog immediately.
 */
function useBundle(): { bundle: Bundle | null; failed: boolean; retry: () => void } {
  const bundle = useSyncExternalStore(
    subscribe,
    () => memory?.bundle ?? null,
    () => null
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!liveCatalogEnabled) return;
    let cancelled = false;
    setFailed(false);
    loadCatalog().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { bundle: liveCatalogEnabled ? bundle : null, failed, retry: () => setAttempt((n) => n + 1) };
}

export type LiveCatalog = Catalog & {
  /** False until the live list has arrived (show placeholders, not stale cards). */
  loaded: boolean;
  /** The live request failed — offer a retry. */
  failed: boolean;
  retry: () => void;
};

/** These products as they are now, for one small request (the shopper's saved cart). */
export async function liveProducts(ids: string[]): Promise<Product[]> {
  if (!liveCatalogEnabled || ids.length === 0) return [];
  const rows = await rest(`products?id=in.(${ids.join(",")})&select=*`);
  return rows.map(rowToProduct);
}

/** Categories + on-sale products. */
export function useLiveCatalog(initial: Catalog): LiveCatalog {
  const { bundle, failed, retry } = useBundle();
  if (!liveCatalogEnabled) return { ...initial, loaded: true, failed: false, retry };
  return {
    categories: bundle?.categories ?? initial.categories,
    products: bundle?.products ?? initial.products,
    loaded: Boolean(bundle) || failed,
    failed,
    retry,
  };
}

/** "More like this": other on-sale stickers in the same category (no extra request). */
export function useRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  initial: Product[]
): { products: Product[]; loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { products: initial, loaded: true };
  const products = bundle
    ? bundle.products.filter((p) => p.id !== excludeId && inCategory(p, categoryId)).slice(0, 10)
    : [];
  return { products, loaded: Boolean(bundle) || failed };
}

/** The product on its own page, kept current (no extra request). */
export function useLiveProduct(
  slug: string,
  initial: Product
): { product: Product; unavailable: boolean; checked: boolean } {
  const { bundle } = useBundle();
  const checked = useCatalogChecked();
  if (!liveCatalogEnabled || !bundle) return { product: initial, unavailable: false, checked };
  const live = bundle.products.find((p) => p.slug === slug);
  return live ? { product: live, unavailable: false, checked } : { product: initial, unavailable: true, checked };
}

/**
 * True once the catalog on the page has been checked with the database. Until
 * then it may be this browser's saved copy or the page's build-time snapshot,
 * so anything that must match the admin (a wall's posters) waits for it.
 */
export function useCatalogChecked(): boolean {
  const { bundle, failed } = useBundle();
  return !liveCatalogEnabled || failed || Boolean(bundle?.fresh);
}

/** Minimum order + shipping zones from the admin (defaults until `loaded`). */
export function useStoreSettings(): StoreSettings & { loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { ...DEFAULT_STORE_SETTINGS, loaded: true };
  // Prices come from here: `loaded` waits for the re-checked row, so a saved
  // (possibly outdated) price or the built-in default never shows.
  return { ...(bundle?.settings ?? DEFAULT_STORE_SETTINGS), loaded: Boolean(bundle?.fresh) || failed };
}

/** Before the admin's switches arrive, nothing optional shows (no flash of a switched-off feature). */
const FEATURES_PENDING = Object.fromEntries(
  Object.keys(DEFAULT_FEATURES).map((key) => [key, false])
) as FeatureFlags;

/**
 * Feature switches from the admin (Features). Everything is off until the
 * real settings load (one small request, then cached for in-app navigation);
 * if they can't be loaded, the defaults apply.
 */
export function useFeatures(): FeatureFlags {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return DEFAULT_FEATURES;
  if (bundle) return bundle.features;
  return failed ? DEFAULT_FEATURES : FEATURES_PENDING;
}

/** Home page layout from the admin (Home page). */
export function useHomePage(): HomePage {
  const { bundle } = useBundle();
  return bundle?.homePage ?? DEFAULT_HOME_PAGE;
}

export function useHomeRails(initial: HomeRail[]): { rails: HomeRail[]; loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { rails: initial, loaded: true };
  return { rails: bundle?.rails ?? initial, loaded: Boolean(bundle) || failed };
}

/** Festivals from the admin (Festivals) — what's on is worked out by date in the browser. */
export function useFestivals(initial: Festival[]): { festivals: Festival[]; loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { festivals: initial, loaded: true };
  return { festivals: bundle?.festivals ?? initial, loaded: Boolean(bundle) || failed };
}

/** Approved reviews for one sticker, newest first (no extra request). */
export function useProductReviews(productId: string): {
  reviews: PublicReview[];
  average: number;
  loaded: boolean;
} {
  const { bundle, failed } = useBundle();
  const reviews = bundle ? bundle.reviews.filter((r) => r.productId === productId) : [];
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  return { reviews, average, loaded: Boolean(bundle) || failed || !liveCatalogEnabled };
}

const notAPerson = () => typeof window === "undefined" || navigator.webdriver || /bot|crawl|spider|lighthouse|facebookexternalhit/i.test(navigator.userAgent);
/** Today in India's calendar, like the days in the database. */
const indiaDay = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function rpc(name: string, body: Record<string, unknown>) {
  fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Counts this browser as one visitor today. It remembers the last day it was
 * counted and sends that along, so the database moves its 1 to today and the
 * same person is never in two days' counts. Storage off: not counted at all.
 */
export function recordVisitor() {
  if (!liveCatalogEnabled || notAPerson()) return;
  const today = indiaDay();
  let prev: string | null;
  try {
    prev = localStorage.getItem("stickypie.lastSeen");
    if (prev === today) return;
    localStorage.setItem("stickypie.lastSeen", today);
  } catch {
    return;
  }
  rpc("record_visitor", { p_prev: prev });
}

/** Whether this is this browser's first look at a sticker today, and its last look before that. */
function lookToday(productId: string): { p_new: boolean; p_prev: string | null } {
  const today = indiaDay();
  try {
    const looks: Record<string, string> = JSON.parse(localStorage.getItem("stickypie.looks") || "{}");
    const prev = looks[productId] ?? null;
    if (prev === today) return { p_new: false, p_prev: null };
    delete looks[productId];
    looks[productId] = today;
    localStorage.setItem("stickypie.looks", JSON.stringify(Object.fromEntries(Object.entries(looks).slice(-300))));
    return { p_new: true, p_prev: prev };
  } catch {
    return { p_new: false, p_prev: null };
  }
}

/** Adds 1 to a sticker's views or saves (record_product_view / _save), once per visit. */
function countOnce(kind: "view" | "save", productId: string) {
  if (!liveCatalogEnabled || notAPerson()) return;
  const key = kind === "view" ? "stickypie.viewed" : "stickypie.saved";
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (seen.includes(productId)) return;
    sessionStorage.setItem(key, JSON.stringify([...seen, productId].slice(-200)));
  } catch {
    // storage off: still count it
  }
  rpc(`record_product_${kind}`, kind === "view" ? { p_product: productId, ...lookToday(productId) } : { p_product: productId });
}

/**
 * Counts one view of a sticker page for the admin's "Most viewed" list: once
 * per product per browser visit (reloads and going back don't add more), and
 * one person however many times they come back. Only the product id and the
 * day they last looked are sent — nothing about the shopper.
 */
export const recordProductView = (productId: string) => countOnce("view", productId);

/**
 * While a sticker page is open, stops the easy ways to download its pictures —
 * right-click menu, long-press "Save image" (phones) and dragging — and counts
 * each try as a "save" (once per sticker per visit). Screenshots can't be
 * stopped or seen. Phones' long-press menu is turned off in CSS
 * (html[data-no-save], globals.css); Android also sends "contextmenu".
 * Returns the cleanup.
 */
export function watchImageSaves(productId: string) {
  // This sticker's pictures only: other stickers' cards on the page are links.
  const isImg = (t: EventTarget | null) => t instanceof HTMLImageElement && !t.closest("a[href]");
  const count = (e: Event) => {
    if (!isImg(e.target)) return;
    e.preventDefault();
    countOnce("save", productId);
  };
  // iPhones don't send "contextmenu" on a long-press, so time the touch.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const touchStart = (e: TouchEvent) => {
    clearTimeout(timer);
    if (e.touches.length === 1 && isImg(e.target)) timer = setTimeout(() => countOnce("save", productId), 600);
  };
  const touchEnd = () => clearTimeout(timer);
  document.documentElement.dataset.noSave = "";
  document.addEventListener("contextmenu", count, true);
  document.addEventListener("dragstart", count, true);
  document.addEventListener("touchstart", touchStart, { capture: true, passive: true });
  for (const ev of ["touchend", "touchmove", "touchcancel"]) document.addEventListener(ev, touchEnd, { capture: true, passive: true });
  return () => {
    clearTimeout(timer);
    delete document.documentElement.dataset.noSave;
    document.removeEventListener("contextmenu", count, true);
    document.removeEventListener("dragstart", count, true);
    document.removeEventListener("touchstart", touchStart, true);
    for (const ev of ["touchend", "touchmove", "touchcancel"]) document.removeEventListener(ev, touchEnd, true);
  };
}
