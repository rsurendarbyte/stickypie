"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DEFAULT_HOME_RAILS,
  HOME_RAIL_KINDS,
  resolveHomeRails,
  type Category,
  type HomeRail,
  type HomeRailKind,
  type Product,
} from "@stickypie/shared";
import { imageSrc } from "@/lib/img";
import { SelectField, TextField } from "./field";
import { useToast } from "./toast";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const NEW_TITLES: Record<HomeRailKind, string> = {
  custom: "Staff picks",
  featured: "Top Picks This Week",
  new: "New Drops",
  category: "",
  categories: "",
};

export default function HomeRailsEditor({
  initial,
  products,
  categories,
  shopUrl,
}: {
  initial: HomeRail[];
  products: Product[];
  categories: Category[];
  shopUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rails, setRails] = useState<HomeRail[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(rails) !== saved;

  const onSale = useMemo(() => products.filter((p) => p.isActive), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function update(index: number, patch: Partial<HomeRail>) {
    setRails((list) => list.map((rail, i) => (i === index ? { ...rail, ...patch } : rail)));
  }

  function addRail(kind: HomeRailKind) {
    setRails((list) => [
      ...list,
      {
        id: `${kind}-${Date.now().toString(36)}`,
        kind,
        title: NEW_TITLES[kind],
        categoryId: kind === "category" ? (categories[0]?.id ?? null) : null,
        productIds: [],
        visible: true,
        limit: kind === "categories" ? 12 : 10,
      },
    ]);
  }

  /** How many stickers the rail will show right now (on-sale only). */
  function shownCount(rail: HomeRail): string {
    if (rail.kind === "categories") {
      const rows = categories.filter((c) => onSale.some((p) => p.categoryId === c.id)).length;
      return `${rows} rail${rows === 1 ? "" : "s"}`;
    }
    const n = resolveHomeRails([{ ...rail, visible: true }], onSale, categories)[0]?.items.length ?? 0;
    return n === 0 ? "nothing to show — hidden in the shop" : `${n} sticker${n === 1 ? "" : "s"}`;
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/home-rails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rails),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setRails(data.rails);
      setSaved(JSON.stringify(data.rails));
      toast("Home page saved — live now");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-28">
      <ol className="space-y-3">
        {rails.map((rail, index) => (
          <li
            key={rail.id}
            className={`rounded-2xl border bg-ink2 p-4 transition-opacity ${
              rail.visible ? "border-line" : "border-dashed border-line opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-panel text-xs font-bold text-fog">
                {index + 1}
              </span>
              <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">
                {HOME_RAIL_KINDS[rail.kind].label}
              </span>
              <span className="text-xs text-fog">{shownCount(rail)}</span>
              <div className="ml-auto flex items-center gap-1">
                <IconButton label="Move up" onClick={() => setRails((l) => move(l, index, index - 1))} disabled={index === 0}>
                  <ArrowUp className="size-4" />
                </IconButton>
                <IconButton
                  label="Move down"
                  onClick={() => setRails((l) => move(l, index, index + 1))}
                  disabled={index === rails.length - 1}
                >
                  <ArrowDown className="size-4" />
                </IconButton>
                <IconButton
                  label={rail.visible ? "Hide rail" : "Show rail"}
                  onClick={() => update(index, { visible: !rail.visible })}
                >
                  {rail.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </IconButton>
                <IconButton
                  label="Remove rail"
                  danger
                  onClick={() => {
                    if (confirm("Remove this rail from the home page?"))
                      setRails((l) => l.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_130px]">
              {rail.kind === "categories" ? (
                <p className="self-center text-xs text-fog sm:col-span-2">
                  One rail per category that has stickers on sale, in your category order (Categories
                  page). Categories with their own rail here are skipped.
                </p>
              ) : (
                <TextField
                  label="Rail title"
                  value={rail.title}
                  onChange={(e) => update(index, { title: e.target.value })}
                  hint={rail.kind === "category" ? "Leave empty to use the category name" : undefined}
                  className={rail.kind === "category" ? "" : "sm:col-span-2"}
                />
              )}
              {rail.kind === "category" && (
                <SelectField
                  label="Category"
                  value={rail.categoryId ?? ""}
                  onChange={(e) => update(index, { categoryId: e.target.value || null })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
              )}
              <TextField
                label={rail.kind === "categories" ? "Per rail" : "Show up to"}
                value={String(rail.limit)}
                inputMode="numeric"
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, "")) || 1;
                  update(index, { limit: Math.min(Math.max(n, 1), 40) });
                }}
              />
            </div>

            <CustomItems
              intro={
                rail.kind === "custom"
                  ? null
                  : rail.kind === "categories"
                    ? "Pinned stickers go first in their own category's rail; the rest fill in automatically."
                    : "Pinned stickers show first, in this order; the rest fill in automatically."
              }
              emptyText={
                rail.kind === "custom"
                  ? "No stickers yet — search below to add some."
                  : "Nothing pinned — the rail fills itself automatically."
              }
              searchPlaceholder={rail.kind === "custom" ? "Search stickers to add…" : "Search stickers to pin…"}
              ids={rail.productIds}
              productById={productById}
              products={products}
              onChange={(productIds) => update(index, { productIds })}
            />
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-2xl border border-dashed border-line p-4">
        <p className="text-[10.5px] font-semibold tracking-widest text-fog uppercase">Add a rail</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(HOME_RAIL_KINDS) as HomeRailKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => addRail(kind)}
              title={HOME_RAIL_KINDS[kind].hint}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-snow"
            >
              <Plus className="size-3.5" /> {HOME_RAIL_KINDS[kind].label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex w-full max-w-[1000px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="pie-gradient inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Save home page
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset to the default layout? (Takes effect when you save.)"))
                setRails(DEFAULT_HOME_RAILS);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-fog hover:text-snow"
          >
            <RotateCcw className="size-3.5" /> Reset to default
          </button>
          <span className="text-xs text-fog">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          {error && <span className="text-xs text-brand">{error}</span>}
          <a
            href={shopUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            View shop <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg text-fog transition-colors disabled:opacity-30 ${
        danger ? "hover:bg-brand/15 hover:text-brand" : "hover:bg-white/10 hover:text-snow"
      }`}
    >
      {children}
    </button>
  );
}

function CustomItems({
  intro,
  emptyText,
  searchPlaceholder,
  ids,
  productById,
  products,
  onChange,
}: {
  intro: string | null;
  emptyText: string;
  searchPlaceholder: string;
  ids: string[];
  productById: Map<string, Product>;
  products: Product[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => !ids.includes(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [query, products, ids]);

  return (
    <div className="mt-3 border-t border-line/60 pt-3">
      {intro && (
        <p className="mb-2 text-[10.5px] font-semibold tracking-widest text-fog uppercase">
          Pinned stickers <span className="font-normal tracking-normal normal-case">· {intro}</span>
        </p>
      )}
      {ids.length === 0 ? (
        <p className="text-xs text-fog">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {ids.map((id, i) => {
            const p = productById.get(id);
            return (
              <li key={id} className="flex items-center gap-2.5 rounded-xl bg-panel/50 px-2 py-1.5">
                <span className="w-5 text-center text-[11px] font-bold text-fog">{i + 1}</span>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink p-0.5">
                  {p?.imageUrl && (
                    <img src={imageSrc(p.imageUrl)} alt="" className="max-h-full max-w-full object-contain" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p ? p.name : "Deleted sticker"}
                  {p && !p.isActive && (
                    <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                      Not for sale — skipped
                    </span>
                  )}
                </span>
                <IconButton label="Move up" onClick={() => onChange(move(ids, i, i - 1))} disabled={i === 0}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton label="Move down" onClick={() => onChange(move(ids, i, i + 1))} disabled={i === ids.length - 1}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton label="Remove" danger onClick={() => onChange(ids.filter((x) => x !== id))}>
                  <X className="size-3.5" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative mt-2.5">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fog" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-line bg-ink py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand/60"
        />
        {matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-ink2 shadow-2xl">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...ids, p.id].slice(0, 40));
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-white/5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-panel p-0.5">
                    <img src={imageSrc(p.imageUrl)} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  {!p.isActive && <span className="text-[10px] font-bold text-gold">not for sale</span>}
                  <Plus className="size-4 text-brand" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
