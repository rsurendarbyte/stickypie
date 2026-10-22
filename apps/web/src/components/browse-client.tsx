"use client";

import HoverLink from "./hover-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ALL_STICKERS_PATH, categoryPath, categoryTitle, inCategory } from "@stickypie/shared";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import VirtualGrid from "./virtual-grid";
import { ArrowUpDown } from "lucide-react";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";

/**
 * Client-side catalog browser. The page ships as a free static asset with a
 * build-time snapshot, refreshes live from the Supabase API in the browser,
 * and all searching/filtering/sorting is local — zero server requests.
 */
const SORTS = [
  { value: "new", label: "Newest" },
  { value: "price-asc", label: "Price: low → high" },
  { value: "price-desc", label: "Price: high → low" },
];

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
    `shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium transition-all sm:px-4 sm:py-1.5 sm:text-sm ${
      active
        ? "border-transparent pie-gradient text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;

  return (
    <>
      {/* Title and count on one line — compact on phones */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h1 className="font-display text-2xl font-bold sm:text-4xl">
          {activeCategoryName ? categoryTitle(activeCategoryName) : "All stickers"}
        </h1>
        <p className="text-xs text-fog sm:text-sm">
          {!loaded ? (
            "Loading…"
          ) : q ? (
            <>
              {visible.length} result{visible.length === 1 ? "" : "s"} for “{q}”
            </>
          ) : (
            <>{visible.length} stickers</>
          )}
        </p>
      </div>

      {/* Category chips scroll sideways; sort is one small pill beside them */}
      <div className="mt-3 flex items-center gap-2 sm:mt-5">
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1 sm:gap-2">
          <HoverLink href={hrefFor("")} scroll={false} className={chip(!category)}>
            All
          </HoverLink>
          {shownCategories.map((c) => (
            <HoverLink key={c.id} href={hrefFor(c.slug)} scroll={false} className={chip(category === c.slug)}>
              {c.name}
            </HoverLink>
          ))}
        </div>
        <label className="relative flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-ink2 px-2.5 text-xs font-semibold text-snow transition-colors hover:border-fog/40 sm:h-9 sm:px-3.5 sm:text-sm">
          <ArrowUpDown className="size-3.5 text-fog" />
          <span className="hidden sm:inline">{SORTS.find((x) => x.value === sort)?.label ?? "Newest"}</span>
          <span className="sr-only sm:hidden">Sort</span>
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            aria-label="Sort by"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {SORTS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
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
        // Only the rows near the screen are rendered — smooth with hundreds of stickers.
        <VirtualGrid
          items={visible}
          getKey={(product) => product.id}
          render={(product) => <ProductCard product={product} width="w-full" />}
          className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:mt-8 sm:gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
        />
      )}
    </>
  );
}
