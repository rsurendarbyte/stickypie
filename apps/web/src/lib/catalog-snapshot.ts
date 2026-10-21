// Server-only: what a statically built page may embed about the catalog.
//
// With the live Supabase API configured, pages embed NO product lists — the
// browser loads them live and RLS returns only products that are on sale, so
// a sticker taken off sale after the last deploy never reaches visitors.
// Demo mode (no Supabase) has no live API, so it keeps the build-time data.
import type { Product } from "@stickypie/shared";

const liveCatalog = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function productSnapshot(products: Product[]): Product[] {
  return liveCatalog ? [] : products;
}
