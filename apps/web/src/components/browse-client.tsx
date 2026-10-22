"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ALL_STICKERS_PATH, categoryPath, categoryTitle, inCategory } from "@stickypie/shared";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import { SelectField } from "./field";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";

/**
 * Client-side catalog browser. The page ships as a free static asset with a
 * build-time snapshot, refreshes live from the Supabase API in the browser,
 * and all searching/filtering/sorting is local — zero server requests.
 */
export default function BrowseClient({
  initial,
  categorySlug = "",
}: {
  initial: Catalog;
  /** From the URL path: /stickers/<slug>. Empty = all stickers. */
  categorySlug?: string;
}) {
  const { categories, products, loaded, failed, retry } = useLiveCatalog(initial);
  useWindowScrollMemory(loaded);
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const category = categorySlug;
  const sort = params.get("sort") ?? "new";

  /** Link to a category (or all), keeping the current search + sort. */
  function hrefFor(cat: string) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sort && sort !== "new") sp.set("sort", sort);
    const qs = sp.toString();
    const path = cat ? categoryPath(cat) : ALL_STICKERS_PATH;
    return qs ? `${path}?${qs}` : path;
  }

  function update(next: { category?: string; sort?: string }) {
    const sp = new URLSearchParams();
    const cat = next.category ?? category;
    const sortValue = next.sort ?? sort;
    if (q) sp.set("q", q);
    if (sortValue && sortValue !== "new") sp.set("sort", sortValue);
    const qs = sp.toString();
    const path = cat ? categoryPath(cat) : ALL_STICKERS_PATH;
    router.push(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  const visible = useMemo(() => {
    let list = products;
    if (category) {
      const cat = categories.find((c) => c.slug === category);
      list = cat ? list.filter((p) => inCategory(p, cat.id)) : [];
    }
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.tags.some((t) => t.toLowerCase().includes(needle))
      );
    }
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, categories, q, category, sort]);

  const activeCategoryName = categories.find((c) => c.slug === category)?.name;
  // Only categories that have stickers on sale (plus the one being viewed),
  // so a big category list never shows dead-end chips.
  const shownCategories = useMemo(() => {
    const used = new Set(products.flatMap((p) => p.categoryIds ?? [p.categoryId]));
    return categories.filter((c) => used.has(c.id) || c.slug === category);
  }, [categories, products, category]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
      active
        ? "border-transparent pie-gradient text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;

  return (
    <>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        {activeCategoryName ? categoryTitle(activeCategoryName) : "All stickers"}
      </h1>
      <p className="mt-1 text-sm text-fog">
        {!loaded ? (
          "Loading stickers…"
        ) : q ? (
          <>
            {visible.length} result{visible.length === 1 ? "" : "s"} for “{q}”
          </>
        ) : (
          <>{visible.length} stickers ready to peel</>
        )}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-1">
          <Link href={hrefFor("")} scroll={false} className={chip(!category)}>
            All
          </Link>
          {shownCategories.map((c) => (
            <Link key={c.id} href={hrefFor(c.slug)} scroll={false} className={chip(category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </div>
        <SelectField
          label="Sort by"
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="ml-auto w-48"
        >
          <option value="new">Newest first</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
        </SelectField>
      </div>

      {!loaded ? (
        <div
          aria-busy="true"
          className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <ProductCardSkeleton key={i} index={i} width="w-full" />
          ))}
        </div>
      ) : failed && products.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-xl font-semibold">Couldn&apos;t load the stickers</p>
          <button
            type="button"
            onClick={retry}
            className="peel-btn peel-btn--brand rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-2 text-center">
          <p className="font-display text-xl font-semibold">No stickers found</p>
          <p className="text-sm text-fog">Try a different search or category.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} width="w-full" />
          ))}
        </div>
      )}
    </>
  );
}
