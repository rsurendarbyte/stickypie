"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import LabelModal from "./label-modal";

export type FilterCategory = { slug: string; name: string; count: number };

/**
 * One "Filter & sort" pop-up for the Stickers page: the sort order on top,
 * then every category with its sticker count and a search box to find one
 * fast. Same peel-on / peel-off label as the other pop-ups; picking a
 * category closes it and opens that category.
 */
export default function CategoryFilter({
  categories,
  total,
  active,
  activeName,
  onPick,
  sort,
  sorts,
  onSort,
}: {
  categories: FilterCategory[];
  /** Stickers in "All". */
  total: number;
  /** Current category slug ("" = all). */
  active: string;
  /** Name of the current category, shown on the button. */
  activeName?: string;
  onPick: (slug: string) => void;
  sort: string;
  sorts: { value: string; label: string }[];
  onSort: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    // Phones: don't pop the keyboard over the list straight away.
    if (window.matchMedia("(min-width: 640px)").matches)
      window.setTimeout(() => input.current?.focus(), 60);
  }, [open]);

  // Shown on the button when it isn't the default order.
  const sortLabel =
    sort !== sorts[0]?.value
      ? sorts.find((o) => o.value === sort)?.label
      : null;
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? categories.filter((c) => c.name.toLowerCase().includes(needle))
        : categories,
    [categories, needle],
  );

  function pick(slug: string) {
    setOpen(false);
    if (slug !== active) onPick(slug);
  }

  const row = (on: boolean) =>
    `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
      on ? "bg-brand/[0.08] text-brand" : "text-snow hover:bg-snow/[0.05]"
    }`;
  const tick = (on: boolean) => (
    <span
      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
        on ? "border-brand bg-brand text-white" : "border-line"
      }`}
    >
      {on && <Check className="size-3" strokeWidth={3.5} />}
    </span>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Category: ${activeName ?? "All stickers"}. Change category or sort`}
        className={`relative inline-flex h-10 max-w-full items-center gap-2 rounded-full border-2 pr-3 pl-3.5 text-sm font-semibold transition-colors ${
          active
            ? "border-brand/60 bg-brand/[0.06] text-brand"
            : "border-line bg-ink2 text-snow hover:border-fog/40"
        }`}
      >
        <SlidersHorizontal className="size-4 shrink-0" />
        <span className="truncate">{activeName ?? "All categories"}</span>
        {sortLabel && (
          <span className="hidden shrink-0 text-xs font-medium text-fog min-[360px]:inline">
            · {sortLabel}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 opacity-70" />
      </button>

      <LabelModal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="filter-title"
        className="max-w-sm overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h2
            id="filter-title"
            className="flex items-center gap-2 font-display text-lg font-bold"
          >
            <SlidersHorizontal className="size-4.5 text-brand" /> Category &amp;
            sort
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-full text-fog hover:bg-snow/5 hover:text-snow"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <p className="mt-3 px-4 text-[11px] font-semibold tracking-widest text-fog uppercase">
          Sort by
        </p>
        <div className="mx-4 mt-1.5 flex flex-wrap gap-1.5">
          {sorts.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onSort(o.value)}
              aria-pressed={sort === o.value}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                sort === o.value
                  ? "pie-gradient border-transparent text-white shadow-md shadow-brand/20"
                  : "border-line bg-ink text-fog hover:text-snow"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="mt-4 px-4 text-[11px] font-semibold tracking-widest text-fog uppercase">
          Category
        </p>
        <label className="mx-4 mt-1.5 flex h-10 items-center gap-2 rounded-xl border border-line bg-ink px-3 focus-within:border-brand/60">
          <Search className="size-4 shrink-0 text-fog" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a category"
            aria-label="Find a category"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fog/60 sm:text-sm"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQ("")}
              className="text-fog hover:text-snow"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="mt-2 max-h-[min(45vh,380px)] overflow-y-auto overscroll-contain px-2 pb-3">
          {!needle && (
            <button
              type="button"
              onClick={() => pick("")}
              className={row(!active)}
            >
              {tick(!active)}
              <span className="flex-1">All stickers</span>
              <span className="text-xs font-semibold text-fog tabular-nums">
                {total}
              </span>
            </button>
          )}
          {shown.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => pick(c.slug)}
              className={row(active === c.slug)}
            >
              {tick(active === c.slug)}
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs font-semibold text-fog tabular-nums">
                {c.count}
              </span>
            </button>
          ))}
          {needle && shown.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-fog">
              No category matches “{q.trim()}”.
            </p>
          )}
        </div>
      </LabelModal>
    </>
  );
}
