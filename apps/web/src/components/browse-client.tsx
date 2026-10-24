"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  ALL_STICKERS_PATH,
  categoryPath,
  categoryTitle,
  inCategory,
} from "@stickypie/shared";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import VirtualGrid from "./virtual-grid";
import CategoryFilter from "./category-filter";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";

/**
 * Client-side catalog browser. The page ships as a free static asset with a
 * build-time snapshot, refreshes live from the Supabase API in the browser,
 * and all searching/filtering/sorting is local — zero server requests.
 */
const SORTS = [
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price low → high" },
  { value: "price-desc", label: "Price high → low" },
];

export default function BrowseClient({
  initial,
  categorySlug = "",
}: {
  initial: Catalog;
  /** From the URL path: /stickers/<slug>. Empty = all stickers. */
  categorySlug?: string;
}) {
  const { categories, products, loaded, failed, retry } =
    useLiveCatalog(initial);
  useWindowScrollMemory(loaded);
  const pathname = usePathname();
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
    go(qs ? `${path}?${qs}` : path);
  }

  /**
   * Same page (sort): just update the address bar — no server request.
   * Another category: load its ready-made page (a free static file), since
   * each category page has its own title and text.
   */
  function go(url: string) {
    if (url.split("?")[0] === pathname) window.history.pushState(null, "", url);
    else window.location.assign(url);
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
          p.tags.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    if (sort === "price-asc")
      list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc")
      list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, categories, q, category, sort]);

  const activeCategoryName = categories.find((c) => c.slug === category)?.name;
  // Only categories that have stickers on sale (plus the one being viewed),
  // so a big category list never shows dead-end chips.
  const shownCategories = useMemo(() => {
    const used = new Set(
      products.flatMap((p) => p.categoryIds ?? [p.categoryId]),
    );
    return categories.filter((c) => used.has(c.id) || c.slug === category);
  }, [categories, products, category]);

  // Category pop-up: every category with stickers, with its count.
  const filterCategories = useMemo(
    () =>
      shownCategories.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: products.filter((p) => inCategory(p, c.id)).length,
      })),
    [shownCategories, products],
  );

  return (
    <>
      {/* Title and count on one line — compact on phones */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h1 className="font-display text-2xl font-bold sm:text-4xl">
          {activeCategoryName
            ? categoryTitle(activeCategoryName)
            : "All stickers"}
        </h1>
        <p className="text-xs text-fog sm:text-sm">
          {!loaded ? (
            "Loading…"
          ) : q ? (
            <>
              {visible.length} result{visible.length === 1 ? "" : "s"} for “{q}”
            </>
          ) : (
            <>{visible.length} {category === "mini-posters" ? "posters" : "stickers"}</>
          )}
        </p>
      </div>

      {/* One button: shows the chosen category, opens categories + sort */}
      <div className="mt-3 sm:mt-5">
        <CategoryFilter
          categories={filterCategories}
          total={products.length}
          active={category}
          activeName={activeCategoryName}
          onPick={(slug) => go(hrefFor(slug))}
          sort={sort}
          sorts={SORTS}
          onSort={(v) => update({ sort: v })}
        />
      </div>

      {!loaded ? (
        <div
          aria-busy="true"
          className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:mt-8 sm:gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <ProductCardSkeleton key={i} index={i} width="w-full" />
          ))}
        </div>
      ) : failed && products.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <p className="font-display text-xl font-semibold">
            Couldn&apos;t load the stickers
          </p>
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
          <p className="font-display text-xl font-semibold">
            No stickers found
          </p>
          <p className="text-sm text-fog">
            Try a different search or category.
          </p>
        </div>
      ) : (
        // Only the rows near the screen are rendered — smooth with hundreds of stickers.
        <VirtualGrid
          items={visible}
          getKey={(product) => product.id}
          // the Mini Posters page is all posters, so it can use the tall poster card
          render={(product) => <ProductCard product={product} width="w-full" poster={category === "mini-posters"} />}
          className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:mt-8 sm:gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
        />
      )}
    </>
  );
}
