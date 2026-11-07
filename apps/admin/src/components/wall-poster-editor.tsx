"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Dices, Download, Loader2, Lock, LockOpen, Plus, Replace, RotateCcw, Search, X } from "lucide-react";
import { packPosterSizes, type Category, type Product } from "@stickypie/shared";
import { imageDownloadHref, imageSrc } from "@/lib/img";
import { arrangeWall } from "@/lib/wall-layout";
import { SelectField } from "./field";
import { useToast } from "./toast";

type Poster = { id: string; name: string; image: string; printImage: string; categoryIds: string[]; handPickOnly: boolean };

const shortName = (name: string) => name.replace(/\s*—?\s*Mini Poster$/i, "");

/** Where each spot sits inside the wall, in % of the tight box around the posters. */
function layout(wall: Product, sizes: number[]) {
  const stays = sizes.join() === packPosterSizes(wall).join();
  const spots = stays
    ? wall.tags.find((t) => t.startsWith("wall spots:"))?.slice(11).split(";").map((s) => s.split(",").map(Number))
    : arrangeWall(sizes).spots;
  if (!spots || spots.length !== sizes.length) return null;
  const left = Math.min(...spots.map(([x]) => x));
  const top = Math.min(...spots.map(([, y]) => y));
  const width = Math.max(...spots.map(([x, , w]) => x + w)) - left;
  const height = Math.max(...spots.map(([, y, , h]) => y + h)) - top;
  return {
    ratio: width / height,
    tiles: spots.map(([x, y, w, h]) => ({ left: ((x - left) / width) * 100, top: ((y - top) / height) * 100, width: (w / width) * 100, height: (h / height) * 100 })),
  };
}

/** Change a wall's posters by hand or at random from a category, swap them by dragging, or add and remove some, which lays the wall out afresh. */
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
  const [current, setCurrent] = useState(wall);
  const [items, setItems] = useState(wall.packItems);
  const [sizes, setSizes] = useState(() => packPosterSizes(wall));
  const [addSize, setAddSize] = useState<6 | 9>(6);
  const [drag, setDrag] = useState<{ index: number; dx: number; dy: number } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragEnded = useRef(false);
  const [kept, setKept] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [pickCategory, setPickCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const locked = openOrders.length > 0;
  const byId = useMemo(() => new Map(posters.map((p) => [p.id, p])), [posters]);
  const shape = useMemo(() => layout(current, sizes), [current, sizes]);
  const savedSizes = packPosterSizes(current);
  const dirty = items.join() !== current.packItems.join() || sizes.join() !== savedSizes.join();
  const recounted = items.length !== current.packItems.length;
  const adding = picking === items.length;
  const gaps = items.filter((id) => !id).length;
  const size = (i: number) => (sizes[i] > 6 ? "6×9" : "4×6");
  const used = useMemo(() => new Set(posters.flatMap((p) => p.categoryIds)), [posters]);
  const pool = (id: string) => (id ? posters.filter((p) => p.categoryIds.includes(id)) : posters);
  const randomPool = (id: string) => pool(id).filter((p) => !p.handPickOnly);

  function randomize() {
    const stay = new Set(kept);
    const fresh = randomPool(category)
      .filter((p) => !stay.has(p.id))
      .map((p) => ({ p, key: Math.random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ p }) => p.id);
    const short = items.filter((id) => !stay.has(id)).length - fresh.length;
    setItems((now) => now.map((id) => (stay.has(id) ? id : (fresh.shift() ?? id))));
    if (short > 0) toast(`Only ${items.length - short} posters to pick from here, so ${short} stayed as they were`);
  }

  function swap(from: number, to: number) {
    setItems((now) => now.map((id, i) => (i === from ? now[to] : i === to ? now[from] : id)));
    setPicking(null);
  }

  /** Empties a spot, so the wall keeps its layout until another poster goes there. */
  function clear(index: number) {
    setItems((now) => now.map((id, i) => (i === index ? "" : id)));
    setKept((now) => now.filter((id) => id !== items[index]));
    setPicking(null);
  }

  function removeSpot(index: number) {
    setItems((now) => now.filter((_, i) => i !== index));
    setSizes((now) => now.filter((_, i) => i !== index));
    setPicking(null);
  }

  function choose(id: string) {
    if (adding) {
      setItems((now) => [...now, id]);
      setSizes((now) => [...now, addSize]);
    } else {
      setItems((now) => now.map((old, i) => (i === picking ? id : old)));
    }
    setPicking(null);
  }

  function startDrag(e: React.PointerEvent, i: number) {
    dragEnded.current = false;
    const onControl = (e.target as HTMLElement).closest("[data-tile-control]");
    if (locked || onControl || e.pointerType === "touch" || e.button !== 0) return;
    const [startX, startY] = [e.clientX, e.clientY];
    let moved = false;
    let target: number | null = null;
    const move = (ev: PointerEvent) => {
      const [dx, dy] = [ev.clientX - startX, ev.clientY - startY];
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      setDrag({ index: i, dx, dy });
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => el instanceof HTMLElement && el.dataset.spot && el.dataset.spot !== String(i));
      target = under ? Number((under as HTMLElement).dataset.spot) : null;
      setOver(target);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      setOver(null);
      dragEnded.current = moved;
      if (target !== null) swap(i, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const spotProps = (i: number, style?: React.CSSProperties) => ({
    "data-spot": i,
    onPointerDown: (e: React.PointerEvent) => startDrag(e, i),
    style: drag?.index === i ? { ...style, transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 10 } : style,
  });

  const choices = pool(pickCategory)
    .filter((p) => !items.includes(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase()));

  /** The full-size file for printing, named with the poster's size on this wall. */
  function printHref(id: string, i: number) {
    const poster = byId.get(id);
    return poster ? imageDownloadHref(poster.printImage, `${shortName(poster.name)} ${size(i).replace("×", "x")}`) : "";
  }

  async function downloadAll() {
    const links = items.map(printHref).filter(Boolean);
    toast(`Downloading ${links.length} posters. Allow multiple downloads if your browser asks`);
    for (const href of links) {
      const a = document.createElement("a");
      a.href = href;
      a.download = "";
      a.click();
      await new Promise((done) => setTimeout(done, 500));
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${wall.id}/wall`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packItems: items, packSizes: sizes }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; product?: Product };
      if (!res.ok || !data.product) throw new Error(data.error ?? "Could not save the wall");
      setCurrent(data.product);
      toast(recounted ? `Wall saved — live now. Its price is still ₹${data.product.price}` : "Wall saved — live now");
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
    if (!id) {
      return (
        <>
          <button
            type="button"
            aria-label={`Add a poster to spot ${i + 1}`}
            onClick={() => !dragEnded.current && setPicking(i)}
            className={`absolute inset-0 flex animate-pulse flex-col items-center justify-center gap-1 rounded border-2 border-dashed bg-white/5 text-fog hover:border-brand hover:text-brand ${picking === i || over === i ? "border-brand text-brand" : "border-line"}`}
          >
            <Plus className="size-5" />
            <span className="text-[10px] font-bold">{size(i)}</span>
          </button>
          {items.length > 1 && (
            <button
              type="button"
              data-tile-control
              aria-label={`Take spot ${i + 1} off the wall`}
              title="Take this spot off the wall"
              onClick={() => removeSpot(i)}
              className="absolute top-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white/80 hover:bg-red-600 hover:text-white"
            >
              <X className="size-3" />
            </button>
          )}
        </>
      );
    }
    return (
      <>
        <button
          type="button"
          disabled={locked}
          aria-label={`Change poster ${i + 1}`}
          onClick={() => !dragEnded.current && setPicking(i)}
          className={`group absolute inset-0 cursor-grab overflow-hidden rounded bg-ink ring-2 select-none ${picking === i || over === i ? "ring-brand" : "ring-transparent hover:ring-brand/60"} ${drag?.index === i ? "cursor-grabbing opacity-80 shadow-xl" : ""} disabled:cursor-not-allowed`}
        >
          {poster && <img src={imageSrc(poster.image)} alt={poster.name} draggable={false} className="size-full object-cover" />}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-px text-center text-[9px] font-bold text-white">{size(i)}</span>
        </button>
        {poster && (
          <a
            href={printHref(id, i)}
            download
            data-tile-control
            aria-label={`Download poster ${i + 1} to print`}
            title="Download full size to print"
            className="absolute right-0.5 bottom-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white/80 hover:bg-brand hover:text-white"
          >
            <Download className="size-3" />
          </a>
        )}
        {!locked && (
          <button
            type="button"
            data-tile-control
            aria-label={`Remove poster ${i + 1}`}
            onClick={() => clear(i)}
            className="absolute top-0.5 left-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white/80 hover:bg-red-600 hover:text-white"
          >
            <X className="size-3" />
          </button>
        )}
        {!locked && (
          <button
            type="button"
            data-tile-control
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
            Click a poster to change it, or drag it onto another to swap them. Removing a poster leaves its spot empty to fill again. Taking a spot off the wall or adding a poster rearranges it and redraws its picture, but the price stays until you change it. Use the lock to keep a poster when randomizing.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadAll}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold hover:border-brand/50 hover:text-brand"
        >
          <Download className="size-4" /> Download all to print
        </button>
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
                <span key={i} {...spotProps(i, { left: `${shape.tiles[i].left}%`, top: `${shape.tiles[i].top}%`, width: `${shape.tiles[i].width}%`, height: `${shape.tiles[i].height}%` })} className="absolute">
                  {tile(id, i)}
                </span>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {items.map((id, i) => (
                <span key={i} {...spotProps(i)} className="relative aspect-[2/3]">
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
                  <option value="">All posters ({randomPool("").length})</option>
                  {categories
                    .filter((c) => used.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({randomPool(c.id).length})
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
                {items.length < 60 && (
                  <button
                    type="button"
                    onClick={() => setPicking(items.length)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold hover:border-brand/50 hover:text-brand"
                  >
                    <Plus className="size-4" /> Add a poster
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {adding ? <Plus className="size-4 text-brand" /> : <Replace className="size-4 text-brand" />}
                    {adding ? "New poster" : `Poster ${picking + 1} · ${size(picking)} in`}
                  </p>
                  <button type="button" aria-label="Close" onClick={() => setPicking(null)} className="text-fog hover:text-snow">
                    <X className="size-4" />
                  </button>
                </div>
                {adding && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {([6, 9] as const).map((inches) => (
                      <button
                        key={inches}
                        type="button"
                        onClick={() => setAddSize(inches)}
                        className={`h-9 rounded-xl border text-sm font-semibold ${addSize === inches ? "border-brand bg-brand/10 text-brand" : "border-line text-fog"}`}
                      >
                        {inches === 9 ? "6×9 in" : "4×6 in"}
                      </button>
                    ))}
                  </div>
                )}
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
                <p className="mt-2 text-xs text-fog">{choices.length} posters, scroll to see them all</p>
                <div className="mt-1.5 grid max-h-[60vh] grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                  {choices.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={shortName(p.name)}
                      onClick={() => choose(p.id)}
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
                disabled={!dirty || saving || gaps > 0}
                onClick={save}
                className="pie-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Save wall
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => {
                  setItems(current.packItems);
                  setSizes(savedSizes);
                  setPicking(null);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-fog hover:text-snow disabled:opacity-50"
              >
                <RotateCcw className="size-4" /> Undo changes
              </button>
              {!dirty && (
                <button type="button" disabled={saving} onClick={save} className="text-xs font-semibold text-fog hover:text-snow disabled:opacity-50">
                  Refresh wall picture
                </button>
              )}
              {dirty && <span className="text-xs text-gold">{gaps > 0 ? `Fill ${gaps} empty spot${gaps === 1 ? "" : "s"} to save` : "Not saved yet"}</span>}
              {recounted && <span className="w-full text-xs text-gold">{items.length} posters now. The price stays ₹{current.price} unless you change it below.</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
