"use client";

// Live catalog over the Supabase REST API, straight from the browser.
//
// The storefront pages are shipped as free static assets (unlimited reach on
// Cloudflare); on load they refresh themselves against Supabase so stock,
// prices, availability and brand-new stickers are always current — with zero
// Worker requests. Requires the PUBLIC anon key (safe: RLS only exposes
// active products & categories). Without the env vars (local demo mode) the
// hooks simply keep the server-rendered data.
import { useEffect, useState } from "react";
import type { Category, Product } from "@stickypie/shared";
import { rowToCategory, rowToProduct } from "@stickypie/shared";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const liveCatalogEnabled = Boolean(SUPABASE_URL && ANON_KEY);

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

/** Static snapshot in, live catalog out (snapshot kept on any failure). */
export function useLiveCatalog(initial: Catalog): Catalog {
  const [data, setData] = useState(initial);

  useEffect(() => {
    if (!liveCatalogEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [categoryRows, productRows] = await Promise.all([
          rest("categories?select=*&order=sort.asc,name.asc"),
          rest("products?select=*&is_active=eq.true&order=created_at.desc"),
        ]);
        if (!cancelled) {
          setData({
            categories: categoryRows.map(rowToCategory),
            products: productRows.map(rowToProduct),
          });
        }
      } catch {
        // Offline or misconfigured: the build-time snapshot stays on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

/** Refreshes one product (stock/price/availability) on the product page. */
export function useLiveProduct(
  slug: string,
  initial: Product
): { product: Product; unavailable: boolean } {
  const [product, setProduct] = useState(initial);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setProduct(initial);
    setUnavailable(false);
    if (!liveCatalogEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await rest(
          `products?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`
        );
        if (cancelled) return;
        const row = rows[0];
        if (!row || !row.is_active) {
          setUnavailable(true);
        } else {
          setProduct(rowToProduct(row));
        }
      } catch {
        // Keep the snapshot.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, initial.id]);

  return { product, unavailable };
}
