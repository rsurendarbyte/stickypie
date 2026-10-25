"use client";

// Live catalog over the Supabase REST API, straight from the browser — with
// as few requests as possible:
//
//   1. ONE small row (store_settings: shipping settings, home layout, features
//      and `catalog_version`), asked for at most once every META_TTL_MS: shop
//      links are plain page loads, so the row is kept in localStorage and the
//      next pages reuse it without any request. Whatever is saved is shown at
//      once and re-checked in the background (see loadCatalog).
//   2. The full catalog (categories + on-sale products) is kept in IndexedDB
//      and only re-downloaded when `catalog_version` changed — the database
//      bumps it whenever the admin edits a product/category/setting or stock
//      moves after a sale. So everyone sees admin changes on their next page
//      load, and nobody re-downloads an unchanged catalog.
//   3. Within one page, every hook shares the in-memory copy; product pages and
//      "More like this" read from it instead of asking the API again.
//   So a shopper browsing for a few minutes makes one small request in total;
//   admin changes reach them within META_TTL_MS (checkout re-checks prices and
//   stock on the server anyway).
//
// RLS only exposes is_active products, so items taken off sale never reach the
// browser. Demo mode (no Supabase env) keeps the server-rendered data.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Category, FeatureFlags, HomeRail, Product, PublicReview, StoreSettings } from "@stickypie/shared";
import {
  DEFAULT_FEATURES,
  DEFAULT_STORE_SETTINGS,
  inCategory,
  rowToCategory,
  rowToFeatures,
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
const META_TTL_MS = 5 * 60_000;

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
  features: FeatureFlags;
  reviews: PublicReview[];
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

/** The store_settings row saved by an earlier page load (any age) and when it was saved. */
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
function publish(meta: any, catalog: CachedCatalog): Bundle {
  const bundle: Bundle = {
    ...catalog,
    settings: rowToSettings(meta),
    rails: rowToHomeRails(meta?.home_rails),
    features: rowToFeatures(meta?.features),
  };
  memory = { bundle, at: Date.now() };
  listeners.forEach((notify) => notify());
  return bundle;
}

/**
 * Never makes the shopper wait for the network when anything is saved:
 *   - fresh saved settings + the matching saved catalog → no request at all;
 *   - anything saved, even out of date → shown at once, then checked in the
 *     background and swapped in place if it changed;
 *   - nothing saved (first visit) → settings and catalog asked for together,
 *     not one after the other.
 */
function loadCatalog(): Promise<Bundle> {
  const hit = freshMemory();
  if (hit) return Promise.resolve(hit);
  inflight ??= (async () => {
    const saved = savedMeta();
    const cached = await idbGet<CachedCatalog>(CACHE_KEY);
    const savedVersion = saved?.meta?.catalog_version ?? null;

    if (saved && cached && cached.version === savedVersion && Date.now() - saved.at < META_TTL_MS) {
      return publish(saved.meta, cached);
    }
    if (saved && cached && !memory) publish(saved.meta, cached);

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
): { product: Product; unavailable: boolean } {
  const { bundle } = useBundle();
  if (!liveCatalogEnabled || !bundle) return { product: initial, unavailable: false };
  const live = bundle.products.find((p) => p.slug === slug);
  return live ? { product: live, unavailable: false } : { product: initial, unavailable: true };
}

/** Minimum order + shipping zones from the admin (defaults until `loaded`). */
export function useStoreSettings(): StoreSettings & { loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { ...DEFAULT_STORE_SETTINGS, loaded: true };
  return { ...(bundle?.settings ?? DEFAULT_STORE_SETTINGS), loaded: Boolean(bundle) || failed };
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
export function useHomeRails(initial: HomeRail[]): { rails: HomeRail[]; loaded: boolean } {
  const { bundle, failed } = useBundle();
  if (!liveCatalogEnabled) return { rails: initial, loaded: true };
  return { rails: bundle?.rails ?? initial, loaded: Boolean(bundle) || failed };
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
