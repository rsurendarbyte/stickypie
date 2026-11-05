"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { packPosterSizes } from "@stickypie/shared";
import { useLiveCatalog } from "@/lib/live-catalog";
import { isMiniPoster, isPosterPack, wallPosterSizes, wallSpots } from "@/lib/poster";
import { posterImage, rememberPosters } from "@/lib/poster-images";
import { pickPoster, useWallLine } from "@/lib/wall-picks";
import LabelModal from "./label-modal";

/** The two faces of a wall set's picture. */
export type WallView = "wall" | "map";

const NO_CATALOG = { categories: [], products: [] };
const noSubscribe = () => () => {};

/** Every poster on sale, for choosing replacements. */
export function usePosterCatalog() {
  const { products } = useLiveCatalog(NO_CATALOG);
  rememberPosters(products);
  return useMemo(() => products.filter((p) => isMiniPoster(p) && !isPosterPack(p) && p.stock !== 0), [products]);
}

/** A dimension line with its length in the middle, like on a drawing. */
function Measure({ label, vertical = false }: { label: string; vertical?: boolean }) {
  const line = vertical ? "w-0.5 flex-1 rounded-full bg-snow/70" : "h-0.5 flex-1 rounded-full bg-snow/70";
  const cap = vertical ? "h-0.5 w-2.5 rounded-full bg-snow/70" : "h-2.5 w-0.5 rounded-full bg-snow/70";
  return (
    <div className={`flex items-center justify-center ${vertical ? "h-full flex-col" : "w-full"}`}>
      <span className={cap} />
      <span className={line} />
      <span className={`shrink-0 font-display text-[13px] leading-none font-bold whitespace-nowrap text-snow ${vertical ? "py-1.5 [writing-mode:vertical-rl] rotate-180" : "px-2"}`}>{label}</span>
      <span className={line} />
      <span className={cap} />
    </div>
  );
}

/**
 * The wall drawn to scale: every real poster faded back with its size on a tag, and
 * how much wall the set covers. Spots and sizes are the ones the wall is built from.
 */
export default function WallSizeMap({ product, posters }: { product: Product; posters?: string[] | null }) {
  const spots = wallSpots(product);
  const sizes = packPosterSizes(product);
  if (!spots.length) return null;
  const ids = posters ?? product.packItems;

  const left = Math.min(...spots.map((s) => s.x));
  const top = Math.min(...spots.map((s) => s.y));
  const width = Math.max(...spots.map((s) => s.x + s.w)) - left;
  const height = Math.max(...spots.map((s) => s.y + s.h)) - top;
  const big = (i: number) => sizes[i] === 9;
  const cm = (inches: number) => Math.round(inches * 2.54);
  // A poster's real size gives the scale, across and down.
  const across = (big(0) ? 6 : 4) / spots[0].w;
  const down = (big(0) ? 9 : 6) / spots[0].h;
  const wide = cm(width * across);
  const tall = cm(height * down);

  return (
    <div className="flex size-full flex-col gap-1">
      <div className="min-h-0 flex-1" style={{ containerType: "size" }}>
        <div className="grid size-full place-items-center">
          <div
            className="grid grid-cols-[1.25rem_minmax(0,1fr)] grid-rows-[1.25rem_minmax(0,1fr)] gap-1"
            style={{ width: `min(100cqw, calc((100cqh - 1.5rem) * ${wide / tall} + 1.5rem))` }}
          >
            <span />
            <Measure label={`${wide} cm`} />
            <Measure label={`${tall} cm`} vertical />
            <div className="relative" style={{ aspectRatio: `${wide} / ${tall}` }}>
              {spots.map((s, i) => (
                <span
                  key={i}
                  className="wall-tile absolute overflow-hidden"
                  style={{
                    left: `${((s.x - left) / width) * 100}%`,
                    top: `${((s.y - top) / height) * 100}%`,
                    width: `${(s.w / width) * 100}%`,
                    height: `${(s.h / height) * 100}%`,
                    containerType: "inline-size",
                  }}
                >
                  {posterImage(ids[i]) && <img src={posterImage(ids[i])!} alt="" draggable={false} className="wall-tile-art absolute inset-0 size-full object-cover" />}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className={`rounded-full px-[0.55em] py-[0.3em] font-display leading-none font-bold whitespace-nowrap ${big(i) ? "bg-snow text-white" : "bg-white text-snow"}`} style={{ fontSize: "clamp(8px, 15cqw, 18px)" }}>
                      {big(i) ? "6×9 in" : "4×6 in"}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="shrink-0 truncate text-center text-xs font-semibold text-snow">
        To scale · {wallPosterSizes(product)} · covers about {wide} × {tall} cm
      </p>
    </div>
  );
}

/** Switches a wall set's picture between the real wall and its size map. */
export function WallViewSwitch({ view, onChange, glass = false }: { view: WallView; onChange: (view: WallView) => void; glass?: boolean }) {
  const views: { id: WallView; label: string }[] = [
    { id: "wall", label: "Wall" },
    { id: "map", label: "Size map" },
  ];
  return (
    <div role="tablist" aria-label="Wall view" className={`inline-flex rounded-full p-0.5 ${glass ? "reel-glass" : "border border-line bg-white"}`}>
      {views.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onChange(id);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${view === id ? "bg-snow text-white" : "text-snow"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Back to the set as sold. In the cart, that takes the customized wall out, so it asks first. */
export function WallReset({ product, price, className, children }: { product: Product; price: number; className: string; children: React.ReactNode }) {
  const { reset, inCart } = useWallLine(product, price);
  const [asking, setAsking] = useState(false);
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return (
    <>
      <button type="button" onPointerUp={(e) => e.stopPropagation()} onClick={() => (inCart ? setAsking(true) : reset())} className={className}>
        {children}
      </button>
      {inBrowser &&
        createPortal(
          <div className="relative z-[2147483000]">
            <LabelModal open={asking} onClose={() => setAsking(false)} labelledBy="wall-reset-title" role="alertdialog" className="max-w-sm p-5">
              <h2 id="wall-reset-title" className="font-display text-lg font-bold">
                Reset this wall?
              </h2>
              <p className="mt-1 text-sm text-fog">Your customized wall will be removed from your cart, and the original posters will come back.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setAsking(false)} className="peel-btn peel-btn--light h-10 rounded-full px-4 text-sm font-bold">
                  Keep my wall
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAsking(false);
                    reset();
                  }}
                  className="peel-btn h-10 rounded-full px-4 text-sm font-bold"
                >
                  Reset wall
                </button>
              </div>
            </LabelModal>
          </div>,
          document.body
        )}
    </>
  );
}

const shortName = (name: string) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;

/** The list a shopper picks a replacement from: closest to the poster being replaced first. */
export function WallPosterSheet({
  product,
  posters,
  spot,
  onClose,
}: {
  product: Product;
  posters: string[] | null;
  spot: number | null;
  onClose: () => void;
}) {
  const catalog = usePosterCatalog();
  const [query, setQuery] = useState("");
  const ids = posters ?? product.packItems;
  const inches = spot === null ? 6 : (packPosterSizes(product)[spot] ?? 6);
  // An emptied spot still suggests posters like the one it held.
  const current = spot === null ? undefined : catalog.find((p) => p.id === (ids[spot] || product.packItems[spot]));
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const alike = (p: Product) => (current ? p.categoryIds.filter((id) => current.categoryIds.includes(id)).length : 0);
    return catalog
      .filter((p) => !ids.includes(p.id) && (p.sizes.length === 0 || p.sizes.some((s) => s.inches === inches)))
      .filter((p) => !q || `${p.name} ${p.tags.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => alike(b) - alike(a));
  }, [catalog, ids, inches, query, current]);
  const close = () => {
    setQuery("");
    onClose();
  };

  // On the page itself, above the cart strip and the buy buttons (like the image zoom).
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!inBrowser) return null;

  return createPortal(
    <div className="relative z-[2147483000]">
    <LabelModal open={spot !== null} onClose={close} labelledBy="wall-pick-title" placement="bottom" className="max-w-lg p-4">
      <h2 id="wall-pick-title" className="font-display text-lg font-bold">
        Choose a poster
        <span className="ml-2 text-sm font-semibold text-fog">{inches === 9 ? "6×9 in" : "4×6 in"}</span>
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
          <button
            key={p.id}
            type="button"
            onClick={() => {
              if (spot !== null) pickPoster(product, spot, p.id);
              close();
            }}
            className="flex min-w-0 flex-col self-start text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbUrl ?? p.imageUrl} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
            <span className="mt-1 block w-full truncate text-[11px] leading-tight text-fog" title={shortName(p.name)}>{shortName(p.name)}</span>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-fog">No posters match that.</p>}
      </div>
    </LabelModal>
    </div>,
    document.body
  );
}
