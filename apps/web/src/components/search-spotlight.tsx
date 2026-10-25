"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  CornerDownLeft,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { categoryPath, formatINR, type Product } from "@stickypie/shared";
import { useLiveCatalog } from "@/lib/live-catalog";
import LabelModal from "./label-modal";

const RECENT_KEY = "stickypie.recent-search";
const EMPTY = { categories: [], products: [] };

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x) => typeof x === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  try {
    const next = [
      q,
      ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase()),
    ].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

/**
 * Spotlight-style search: a big search bar that drops in near the top of the
 * screen (as a peel-on label), with live sticker results as you type, matching
 * categories, and your recent searches. Arrow keys + Enter work; ⌘K / Ctrl K
 * or "/" open it from anywhere.
 */
export default function SearchSpotlight({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LabelModal
      open={open}
      onClose={onClose}
      placement="top"
      labelledBy="search-title"
      className="max-w-xl overflow-hidden"
    >
      {/* mounts fresh on every open; stays while the label peels off */}
      <SpotlightBody onClose={onClose} />
    </LabelModal>
  );
}

function SpotlightBody({ onClose }: { onClose: () => void }) {
  const { categories, products, loaded } = useLiveCatalog(EMPTY);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(readRecent());
    // Focus after the label has started to smooth down (keeps phones from jumping).
    const t = window.setTimeout(() => input.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  const needle = q.trim().toLowerCase();
  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const results = useMemo(() => {
    if (!needle) return [];
    const words = needle.split(/\s+/);
    const score = (p: Product) => {
      const name = p.name.toLowerCase();
      const hay = `${name} ${p.tags.join(" ").toLowerCase()} ${(catName.get(p.categoryId ?? "") ?? "").toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) return -1;
      return name.startsWith(needle) ? 3 : name.includes(needle) ? 2 : 1;
    };
    return products
      .map((p) => ({ p, s: score(p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
  }, [needle, products, catName]);
  const matchedCats = needle
    ? categories
        .filter((c) => c.name.toLowerCase().includes(needle))
        .slice(0, 4)
    : [];
  const top = results.slice(0, 7);
  const fresh = needle ? [] : products.slice(0, 4);

  // Everything you can arrow to, in order.
  type Item = { key: string; go: () => void };
  const items: Item[] = [
    ...top.map((p) => ({ key: p.id, go: () => go(`/sticker/${p.slug}`, q) })),
    ...matchedCats.map((c) => ({
      key: c.id,
      go: () => go(categoryPath(c.slug)),
    })),
    ...(needle ? [{ key: "all", go: () => searchAll() }] : []),
    ...(!needle
      ? recent.map((r) => ({ key: `r:${r}`, go: () => setQ(r) }))
      : []),
    ...fresh.map((p) => ({ key: p.id, go: () => go(`/sticker/${p.slug}`) })),
  ];

  useEffect(() => setActive(0), [needle]);
  useEffect(() => {
    list.current
      ?.querySelector(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(href: string, remember?: string) {
    if (remember?.trim()) saveRecent(remember.trim());
    onClose();
    window.location.assign(href); // ready-made page, no Worker request
  }
  function searchAll() {
    const t = q.trim();
    go(t ? `/stickers?q=${encodeURIComponent(t)}` : "/stickers", t);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) items[active].go();
      else searchAll();
    }
  }

  let i = -1;
  const row = (on: boolean) =>
    `flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
      on ? "bg-brand/[0.07]" : "hover:bg-snow/[0.04]"
    }`;
  const heading =
    "px-2.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-widest text-fog uppercase";

  const productRow = (p: Product, remember?: string) => {
    i += 1;
    const n = i;
    return (
      <button
        key={p.id}
        type="button"
        data-i={n}
        onMouseEnter={() => setActive(n)}
        onClick={() => go(`/sticker/${p.slug}`, remember)}
        className={row(active === n)}
      >
        <span className="grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] size-11 shrink-0 place-items-center rounded-xl bg-ink p-1 shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]">
          <img
            src={p.thumbUrl ?? p.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-contain"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-snow">
            {p.name}
          </span>
          <span className="block truncate text-xs text-fog">
            {catName.get(p.categoryId ?? "") ?? "Sticker"}
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {formatINR(p.price)}
        </span>
      </button>
    );
  };

  return (
    <div onKeyDown={onKey}>
      <h2 id="search-title" className="sr-only">
        Search stickers
      </h2>
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-brand" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search JDM, helmet, cat…"
          enterKeyHint="search"
          aria-label="Search stickers"
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fog/60 sm:h-16 sm:text-lg"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              input.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-fog hover:bg-snow/5 hover:text-snow"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-fog hover:text-snow"
          >
            <span className="hidden sm:inline">Esc</span>
            <span className="sm:hidden">Close</span>
          </button>
        )}
      </div>

      <div
        ref={list}
        className="max-h-[min(62vh,520px)] overflow-y-auto overscroll-contain p-2"
      >
        {needle ? (
          <>
            {top.length > 0 && (
              <>
                <p className={heading}>Stickers</p>
                {top.map((p) => productRow(p, q))}
              </>
            )}
            {matchedCats.length > 0 && (
              <>
                <p className={heading}>Categories</p>
                {matchedCats.map((c) => {
                  i += 1;
                  const n = i;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-i={n}
                      onMouseEnter={() => setActive(n)}
                      onClick={() => go(categoryPath(c.slug))}
                      className={row(active === n)}
                    >
                      <span className="pie-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white">
                        <Sparkles className="size-5" />
                      </span>
                      <span className="flex-1 text-sm font-semibold">
                        {c.name} stickers
                      </span>
                      <ArrowRight className="size-4 text-fog" />
                    </button>
                  );
                })}
              </>
            )}
            {top.length === 0 && matchedCats.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-fog">
                {loaded ? (
                  <>No stickers match “{q.trim()}”. Try another word.</>
                ) : (
                  "Searching…"
                )}
              </p>
            )}
            {(() => {
              i += 1;
              const n = i;
              return (
                <button
                  type="button"
                  data-i={n}
                  onMouseEnter={() => setActive(n)}
                  onClick={searchAll}
                  className={`${row(active === n)} mt-1 justify-between font-semibold text-brand`}
                >
                  <span className="text-sm">
                    See all {results.length} result
                    {results.length === 1 ? "" : "s"} for “{q.trim()}”
                  </span>
                  <CornerDownLeft className="size-4" />
                </button>
              );
            })()}
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <p className={heading}>Recent</p>
                {recent.map((r) => {
                  i += 1;
                  const n = i;
                  return (
                    <button
                      key={r}
                      type="button"
                      data-i={n}
                      onMouseEnter={() => setActive(n)}
                      onClick={() => setQ(r)}
                      className={row(active === n)}
                    >
                      <Clock3 className="ml-1 size-4 text-fog" />
                      <span className="flex-1 truncate text-sm">{r}</span>
                    </button>
                  );
                })}
              </>
            )}
            {categories.length > 0 && (
              <>
                <p className={heading}>Browse</p>
                <div className="flex flex-wrap gap-1.5 px-2.5 pb-1">
                  {categories.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(categoryPath(c.slug))}
                      className="rounded-full border border-line bg-ink px-3 py-1 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {fresh.length > 0 && (
              <>
                <p className={heading}>New drops</p>
                {fresh.map((p) => productRow(p))}
              </>
            )}
          </>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-fog sm:flex">
        <span>
          <kbd className="rounded border border-line px-1">↑</kbd>{" "}
          <kbd className="rounded border border-line px-1">↓</kbd> to move
        </span>
        <span>
          <kbd className="rounded border border-line px-1">Enter</kbd> to open
        </span>
        <span className="ml-auto">
          <kbd className="rounded border border-line px-1">⌘</kbd>{" "}
          <kbd className="rounded border border-line px-1">K</kbd> anywhere
        </span>
      </div>
    </div>
  );
}
