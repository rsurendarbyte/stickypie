"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, Search, Shuffle, ShoppingBag } from "lucide-react";
import {
  CUSTOM_PRODUCT_PREFIX,
  WALL_LAYOUTS,
  formatINR,
  packSizeSummary,
  wallBounds,
  wallLayout,
  wallTileSize,
  type WallLayout,
} from "@stickypie/shared";
import { useCart } from "./cart-context";
import CustomBookBar from "./custom-book-bar";
import LabelModal from "./label-modal";

/** A poster the shopper can put on the wall. */
export type WallPoster = { id: string; name: string; image: string; prices: Record<number, number> };

const SAVED_KEY = "stickypie.wall.v1";

/** "Jimny — The Adventure Awaits Mini Poster" → "Jimny — The Adventure Awaits". */
const shortName = (name: string) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;

/** Random posters for the empty spots, none used twice; those on sale in that size only. */
function fill(layout: WallLayout, posters: WallPoster[], keep: (string | null)[]): string[] {
  const used = new Set(keep.filter(Boolean));
  const spare = [...posters].filter((p) => !used.has(p.id)).sort(() => Math.random() - 0.5);
  return layout.tiles.map((tile, i) => {
    const kept = keep[i];
    if (kept && posters.some((p) => p.id === kept && p.prices[tile.inches])) return kept;
    const at = spare.findIndex((p) => p.prices[tile.inches]);
    return at < 0 ? "" : spare.splice(at, 1)[0].id;
  });
}

/**
 * Pick a wall layout, then a poster for every spot. Made for the phone: the
 * wall stays in view, a tap on a spot opens the poster list from the bottom,
 * and the price and Book button never leave the screen.
 */
export default function WallBuilder({ posters }: { posters: WallPoster[] }) {
  const { add, openCart } = useCart();
  const [layout, setLayout] = useState<WallLayout>(WALL_LAYOUTS[0]);
  const [picks, setPicks] = useState<string[]>([]);
  const [spot, setSpot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(posters.map((p) => [p.id, p])), [posters]);

  // Filled after loading, so the random mix never clashes with the server's HTML.
  useEffect(() => {
    let saved: { layout?: string; picks?: string[] } = {};
    try {
      saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}");
    } catch {
      // nothing saved
    }
    const start = wallLayout(saved.layout ?? "") ?? WALL_LAYOUTS[0];
    setLayout(start);
    setPicks(fill(start, posters, saved.picks ?? []));
  }, [posters]);

  useEffect(() => {
    if (!picks.length) return;
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify({ layout: layout.id, picks }));
    } catch {
      // the wall still works for this visit
    }
  }, [layout, picks]);

  const bounds = wallBounds(layout);
  const chosen = layout.tiles.map((tile, i) => ({ tile, poster: byId.get(picks[i]) ?? null }));
  const ready = picks.length > 0 && chosen.every((c) => c.poster);
  const total = chosen.reduce((sum, c) => sum + (c.poster?.prices[c.tile.inches] ?? 0), 0);
  const summary = packSizeSummary(layout.tiles.map((t) => t.inches));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inches = spot === null ? 6 : layout.tiles[spot]?.inches ?? 6;
    return posters.filter((p) => p.prices[inches] && (!q || p.name.toLowerCase().includes(q)));
  }, [posters, query, spot, layout]);

  function chooseLayout(next: WallLayout) {
    setLayout(next);
    setPicks((prev) => fill(next, posters, prev));
  }

  function choosePoster(id: string) {
    if (spot === null) return;
    setPicks((prev) => prev.map((old, i) => (i === spot ? id : old)));
    setSpot(null);
    setQuery("");
  }

  function addWall(thenCheckout: boolean) {
    if (!ready || busy) return;
    setBusy(true);
    const ref = crypto.randomUUID();
    const first = chosen[0].poster!;
    const added = add({
      productId: `${CUSTOM_PRODUCT_PREFIX}${ref}`,
      size: null,
      sizeLabel: summary,
      slug: "wall-builder",
      name: `Your wall · ${layout.name}`,
      price: total,
      imageUrl: first.image,
      thumbUrl: first.image,
      stock: 1,
      custom: true,
      customRef: ref,
      customKind: "wall",
      customSpec: { kind: "wall", layout: layout.id, posters: picks },
    });
    setBusy(false);
    if (!added) return;
    if (thenCheckout) window.location.assign("/checkout");
    else openCart();
  }

  return (
    <div className="mt-4">
      <div role="radiogroup" aria-label="Wall layout" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {WALL_LAYOUTS.map((l) => {
          const on = l.id === layout.id;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => chooseLayout(l)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-left transition-colors ${
                on ? "border-brand bg-brand/[0.07] ring-1 ring-brand" : "border-line bg-white"
              }`}
            >
              <span className={`block font-display text-sm font-bold ${on ? "text-brand" : "text-snow"}`}>{l.name}</span>
              <span className="block text-[11px] text-fog">{l.tiles.length} posters</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-[#ece7df] p-4">
        <div
          className="relative mx-auto max-h-[56dvh] w-full"
          style={{ aspectRatio: `${bounds.width} / ${bounds.height}`, maxWidth: `calc(56dvh * ${bounds.width / bounds.height})` }}
        >
          {chosen.map(({ tile, poster }, i) => {
            const { width, height } = wallTileSize(tile);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSpot(i)}
                aria-label={poster ? `Change ${shortName(poster.name)}` : "Choose a poster"}
                className="absolute overflow-hidden rounded-[3px] bg-white/60 shadow-[0_2px_6px_rgba(16,24,40,0.28)] transition-transform active:scale-95"
                style={{
                  left: `${(tile.x / bounds.width) * 100}%`,
                  top: `${(tile.y / bounds.height) * 100}%`,
                  width: `${(width / bounds.width) * 100}%`,
                  height: `${(height / bounds.height) * 100}%`,
                }}
              >
                {poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster.image} alt="" loading="lazy" className="size-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-[#6b6459]">
          About {Math.round((bounds.width / 12) * 10) / 10} × {Math.round((bounds.height / 12) * 10) / 10} ft on your wall
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-fog">Tap a poster to change it.</p>
        <button
          type="button"
          onClick={() => setPicks(fill(layout, posters, []))}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-snow"
        >
          <Shuffle className="size-3.5" /> Shuffle
        </button>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-fog">
        <li className="flex items-center gap-1.5"><Check className="size-3.5 text-mint" /> {summary}</li>
        <li className="flex items-center gap-1.5"><Check className="size-3.5 text-mint" /> 300 GSM poster paper, not stickers</li>
        <li className="flex items-center gap-1.5"><Check className="size-3.5 text-mint" /> Glue dots or double-sided tape included</li>
      </ul>

      {/* Desktop buttons; phones use the bar pinned to the bottom. */}
      <div className="mt-5 hidden items-center gap-3 sm:flex">
        <span className="mr-2 font-display text-2xl font-bold">{ready ? formatINR(total) : "—"}</span>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => addWall(false)}
          className="peel-btn peel-btn--light flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-bold"
        >
          <ShoppingBag className="size-4" /> Add to cart
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => addWall(true)}
          className="peel-btn peel-btn--brand flex h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-bold"
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Book now <ArrowRight className="size-4" />
        </button>
      </div>

      <CustomBookBar
        total={ready ? total : null}
        summary={`${layout.name} · ${layout.tiles.length} posters`}
        busy={busy}
        onAdd={() => addWall(false)}
        onBook={() => addWall(true)}
      />

      <LabelModal
        open={spot !== null}
        onClose={() => {
          setSpot(null);
          setQuery("");
        }}
        labelledBy="wall-pick-title"
        placement="bottom"
        className="max-w-lg p-4"
      >
        <h2 id="wall-pick-title" className="font-display text-lg font-bold">
          Choose a poster
          {spot !== null && layout.tiles[spot] && (
            <span className="ml-2 text-sm font-semibold text-fog">
              {layout.tiles[spot].inches === 9 ? "6×9" : "4×6"} · {formatINR(list[0]?.prices[layout.tiles[spot].inches] ?? 0)}
            </span>
          )}
        </h2>
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <Search className="size-4 shrink-0 text-fog" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posters"
            className="w-full bg-transparent text-base outline-none sm:text-sm"
          />
        </label>
        <div className="mt-3 grid max-h-[58dvh] grid-cols-3 gap-2 overflow-y-auto pb-2 sm:grid-cols-4">
          {list.map((p) => (
            <button key={p.id} type="button" onClick={() => choosePoster(p.id)} className="text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
              <span className="mt-1 line-clamp-2 block text-[11px] leading-tight text-fog">{shortName(p.name)}</span>
            </button>
          ))}
          {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-fog">No posters match that.</p>}
        </div>
      </LabelModal>
    </div>
  );
}
