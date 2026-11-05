"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dices, Loader2, Lock, LockOpen, Replace, RotateCcw, Search, X } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import { imageSrc } from "@/lib/img";
import { SelectField } from "./field";
import { useToast } from "./toast";

type Poster = { id: string; name: string; image: string; categoryIds: string[] };

const shortName = (name: string) => name.replace(/\s*—?\s*Mini Poster$/i, "");

/** Where each spot sits inside the wall, in % of the tight box around the posters. */
function layout(wall: Product) {
  const spots = wall.tags.find((t) => t.startsWith("wall spots:"))?.slice(11).split(";").map((s) => s.split(",").map(Number));
  if (!spots || spots.length !== wall.packItems.length) return null;
  const left = Math.min(...spots.map(([x]) => x));
  const top = Math.min(...spots.map(([, y]) => y));
  const width = Math.max(...spots.map(([x, , w]) => x + w)) - left;
  const height = Math.max(...spots.map(([, y, , h]) => y + h)) - top;
  return {
    ratio: width / height,
    tiles: spots.map(([x, y, w, h]) => ({ left: ((x - left) / width) * 100, top: ((y - top) / height) * 100, width: (w / width) * 100, height: (h / height) * 100 })),
  };
}

/** Change a wall's posters by hand or at random from a category. Each spot keeps its size, so layout and price stay. */
export default function WallPosterEditor({
  wall,
  posters,
  categories,
  openOrders,
}: {
  wall: Product;
  posters: Poster[];
  categories: Category[];
  openOrders: { id: string; code: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(wall.packItems);
  const [items, setItems] = useState(wall.packItems);
  const [kept, setKept] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [pickCategory, setPickCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = openOrders.length > 0;
  const byId = useMemo(() => new Map(posters.map((p) => [p.id, p])), [posters]);
  const shape = useMemo(() => layout(wall), [wall]);
  const dirty = items.join() !== saved.join();
  const size = (i: number) => ((wall.packSizes[i] ?? 6) > 6 ? "6×9" : "4×6");
  const used = useMemo(() => new Set(posters.flatMap((p) => p.categoryIds)), [posters]);
  const pool = (id: string) => (id ? posters.filter((p) => p.categoryIds.includes(id)) : posters);

  function randomize() {
    const stay = new Set(kept);
    const fresh = pool(category)
      .filter((p) => !stay.has(p.id))
      .map((p) => ({ p, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ p }) => p.id);
    const short = items.filter((id) => !stay.has(id)).length - fresh.length;
    setItems((now) => now.map((id) => (stay.has(id) ? id : (fresh.shift() ?? id))));
    if (short > 0) toast(`Only ${items.length - short} posters to pick from here, so ${short} stayed as they were`);
  }

  const choices = pool(pickCategory)
    .filter((p) => !items.includes(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 60);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${wall.id}/wall`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packItems: items }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save the wall");
      setSaved(items);
      toast("Wall saved — live now");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the wall", "error");
    } finally {
      setSaving(false);
    }
  }

  const tile = (id: string, i: number) => {
    const poster = byId.get(id);
    const held = kept.includes(id);
    return (
      <>
        <button
          type="button"
          disabled={locked}
          aria-label={`Change poster ${i + 1}`}
          onClick={() => setPicking(i)}
          className={`group absolute inset-0 overflow-hidden rounded bg-ink ring-2 ${picking === i ? "ring-brand" : "ring-transparent hover:ring-brand/60"} disabled:cursor-not-allowed`}
        >
          {poster && <img src={imageSrc(poster.image)} alt={poster.name} className="size-full object-cover" />}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-px text-center text-[9px] font-bold text-white">{size(i)}</span>
        </button>
        {!locked && (
          <button
            type="button"
            aria-label={held ? `Let randomize change poster ${i + 1}` : `Keep poster ${i + 1} when randomizing`}
            onClick={() => setKept((now) => (held ? now.filter((k) => k !== id) : [...now, id]))}
            className={`absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full ${held ? "bg-brand text-white" : "bg-black/60 text-white/80"}`}
          >
            {held ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
          </button>
        )}
      </>
    );
  };

  return (
    <section className="rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Wall posters</h2>
          <p className="mt-0.5 text-xs text-fog">
            Click a poster to change it. Each spot keeps its size, so the layout and price stay. Use the lock to keep a poster when randomizing.
          </p>
        </div>
      </div>

      {locked && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
          <Lock className="size-4 shrink-0" />
          <span>Locked: open orders hold this wall.</span>
          {openOrders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="font-semibold underline underline-offset-2">
              {o.code}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className={locked ? "opacity-60" : ""}>
          {shape ? (
            <div className="relative mx-auto w-full max-w-xl" style={{ aspectRatio: shape.ratio }}>
              {items.map((id, i) => (
                <span key={i} className="absolute" style={{ left: `${shape.tiles[i].left}%`, top: `${shape.tiles[i].top}%`, width: `${shape.tiles[i].width}%`, height: `${shape.tiles[i].height}%` }}>
                  {tile(id, i)}
                </span>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {items.map((id, i) => (
                <span key={i} className="relative aspect-[2/3]">
                  {tile(id, i)}
                </span>
              ))}
            </div>
          )}
        </div>

        {!locked && (
          <div className="min-w-0 space-y-3">
            {picking === null ? (
              <div className="space-y-2">
                <SelectField label="Randomize from" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All posters ({posters.length})</option>
                  {categories
                    .filter((c) => used.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({pool(c.id).length})
                      </option>
                    ))}
                </SelectField>
                <button
                  type="button"
                  onClick={randomize}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold hover:border-brand/50 hover:text-brand"
                >
                  <Dices className="size-4" /> Randomize {kept.length > 0 ? `(keeping ${kept.length})` : "all posters"}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Replace className="size-4 text-brand" /> Poster {picking + 1} · {size(picking)} in
                  </p>
                  <button type="button" aria-label="Close" onClick={() => setPicking(null)} className="text-fog hover:text-snow">
                    <X className="size-4" />
                  </button>
                </div>
                <label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-line bg-ink px-3">
                  <Search className="size-4 shrink-0 text-fog" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posters" className="min-w-0 flex-1 bg-transparent text-sm text-snow outline-none" />
                </label>
                <SelectField className="mt-2" label="Category" value={pickCategory} onChange={(e) => setPickCategory(e.target.value)}>
                  <option value="">All</option>
                  {categories
                    .filter((c) => used.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </SelectField>
                <div className="mt-2 grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                  {choices.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={shortName(p.name)}
                      onClick={() => {
                        setItems((now) => now.map((id, i) => (i === picking ? p.id : id)));
                        setPicking(null);
                      }}
                      className="aspect-[2/3] overflow-hidden rounded ring-2 ring-transparent hover:ring-brand"
                    >
                      <img src={imageSrc(p.image)} alt={p.name} loading="lazy" className="size-full object-cover" />
                    </button>
                  ))}
                  {choices.length === 0 && <p className="col-span-4 py-3 text-sm text-fog">No posters match.</p>}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={save}
                className="pie-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Save wall
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => setItems(saved)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-fog hover:text-snow disabled:opacity-50"
              >
                <RotateCcw className="size-4" /> Undo changes
              </button>
              {!dirty && (
                <button type="button" disabled={saving} onClick={save} className="text-xs font-semibold text-fog hover:text-snow disabled:opacity-50">
                  Refresh wall picture
                </button>
              )}
              {dirty && <span className="text-xs text-gold">Not saved yet</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
