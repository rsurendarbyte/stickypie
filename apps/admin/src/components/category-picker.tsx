"use client";

import { useMemo, useState } from "react";
import { Check, Search, Star, X } from "lucide-react";
import type { Category } from "@stickypie/shared";

/**
 * Pick every category a sticker belongs to. The first one is its main
 * category (breadcrumbs, "more like this") — tap the star to change it.
 */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  error,
}: {
  categories: Category[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const selected = value.filter((id) => byId.has(id));
  const q = query.trim().toLowerCase();
  const shown = q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, 10));
  const makeMain = (id: string) => onChange([id, ...selected.filter((x) => x !== id)]);

  return (
    <div className="rounded-xl border border-line bg-ink2/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-semibold tracking-widest text-fog uppercase">Categories</p>
        <p className="text-[11px] text-fog">
          Pick all that fit · <Star className="inline size-3 fill-gold text-gold" /> = main category
        </p>
      </div>

      {selected.length === 0 ? (
        <p className="mt-2 text-xs text-fog">No category yet — tap the ones below.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((id, i) => (
            <li
              key={id}
              className={`inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-2 text-xs font-semibold ${
                i === 0 ? "border-gold/50 bg-gold/10 text-snow" : "border-brand/40 bg-brand/10 text-snow"
              }`}
            >
              <button
                type="button"
                onClick={() => makeMain(id)}
                disabled={i === 0}
                title={i === 0 ? "Main category" : "Make this the main category"}
                aria-label={i === 0 ? "Main category" : `Make ${byId.get(id)!.name} the main category`}
                className="grid size-5 place-items-center rounded-full text-fog transition-colors hover:text-gold disabled:cursor-default"
              >
                <Star className={`size-3.5 ${i === 0 ? "fill-gold text-gold" : ""}`} />
              </button>
              {byId.get(id)!.name}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove ${byId.get(id)!.name}`}
                className="grid size-5 place-items-center rounded-full text-fog transition-colors hover:bg-white/10 hover:text-brand"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fog" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find a category (${categories.length})…`}
          className="h-10 w-full rounded-xl border border-line bg-ink pr-3 pl-9 text-sm outline-none focus:border-brand/60"
        />
      </div>
      <div className="mt-2.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {shown.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-brand/60 bg-brand/15 text-snow"
                  : "border-line text-fog hover:border-fog/40 hover:text-snow"
              }`}
            >
              {on && <Check className="size-3" />} {c.name}
            </button>
          );
        })}
        {shown.length === 0 && <p className="text-xs text-fog">No category matches “{query}”.</p>}
      </div>
      {error && <p className="mt-2 text-xs text-brand">{error}</p>}
    </div>
  );
}
