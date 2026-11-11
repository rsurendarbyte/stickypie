"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { formatINR, isWallSetOnly, priceForSize, withFinish, type PosterFinish, type Product } from "@stickypie/shared";
import { useFeatures, useLiveCatalog } from "@/lib/live-catalog";
import { isMiniPoster, isPosterPack, isSinglePoster, isWallSetup } from "@/lib/poster";
import { relatedOrder } from "@/lib/related";
import { type CartItem, useCart } from "./cart-context";
import { defaultSize, toCartProduct } from "./size-picker";

const NO_CATALOG = { categories: [], products: [] };
const SHOW = 9;
type Pick = { p: Product; size: number | null; price: number; finish?: PosterFinish };
/** What kind of thing it is, over its name: the cart row mixes them. */
const label = (p: Product, finish?: PosterFinish) =>
  isWallSetup(p) ? "Wall" : finish === "puzzle" ? "Puzzle" : isMiniPoster(p) ? "Wall poster" : "Sticker";
const shortName = (name: string) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;
const image = (p: Product) => p.tinyUrl ?? p.thumbUrl ?? p.imageUrl;

/** A plain sticker (not a poster, wall or custom piece). */
const isPlainSticker = (p: Product) => !isMiniPoster(p) && !isPosterPack(p) && !isWallSetup(p) && !isWallSetOnly(p);

/**
 * Under the minimum order: things to add in one tap, the ones most like what's
 * in the cart first, so a one-poster cart can reach checkout without leaving
 * the cart. A poster cart gets wall posters, puzzle posters and walls mixed (a
 * wall has no minimum); a sticker cart gets stickers. Each at its cheapest size.
 */
export default function CartTopUp({ items, shortBy, onAdded }: { items: CartItem[]; shortBy: number; onAdded?: () => void }) {
  const { products } = useLiveCatalog(NO_CATALOG);
  const { add } = useCart();
  const features = useFeatures();
  // the same order for the whole visit, a fresh one next visit
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));

  const picks = useMemo(() => {
    if (!products.length || shortBy <= 0) return [];
    const inCart = new Set(items.map((i) => i.productId));
    const byId = new Map(products.map((p) => [p.id, p]));
    // the latest cart line we can find in the shop decides what's most alike
    const base = [...items].reverse().map((i) => byId.get(i.productId)).find(Boolean);
    const open = (p: Product) => p.isActive && p.stock !== 0 && !inCart.has(p.id);
    const order = (pool: Product[]) => (base ? relatedOrder(base, pool, seed) : pool);
    const priced = (p: Product, finish?: PosterFinish): Pick => {
      const shown = withFinish(p, finish);
      const size = defaultSize(shown);
      return { p, size, finish, price: priceForSize(shown, size)?.price ?? shown.price };
    };
    // a sticker cart: more stickers
    if (base && isPlainSticker(base)) return order(products.filter((p) => open(p) && isPlainSticker(p))).slice(0, SHOW).map((p) => priced(p));
    // posters: wall posters, puzzle posters and walls, mixed, never the same product twice
    const singles = order(products.filter((p) => open(p) && isSinglePoster(p)));
    const walls = order(products.filter((p) => open(p) && isWallSetup(p)));
    const kinds: (PosterFinish | "wall")[] = features.posterPuzzle ? ["poster", "puzzle", "wall"] : ["poster", "poster", "wall"];
    const out: Pick[] = [];
    let s = 0;
    let w = 0;
    for (let i = 0; out.length < SHOW && (s < singles.length || w < walls.length) && i < SHOW * 3; i++) {
      const kind = kinds[i % kinds.length];
      if (kind === "wall") {
        if (w < walls.length) out.push(priced(walls[w++]));
      } else if (s < singles.length) out.push(priced(singles[s++], kind));
    }
    return out;
  }, [products, items, shortBy, seed, features.posterPuzzle]);

  if (!picks.length) return null;
  const cheapest = Math.min(...picks.map((x) => x.price));

  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-semibold text-snow">
        {cheapest >= shortBy ? "Add 1 more to order" : `Add ${formatINR(shortBy)} more to order`}
        <span className="font-normal text-fog"> · tap + to add</span>
      </p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {picks.map(({ p, size, price, finish }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              if (add(toCartProduct(p, size, price, finish))) onAdded?.();
            }}
            aria-label={`Add ${shortName(p.name)}, ${label(p, finish)}, for ${formatINR(price)}`}
            className="group w-[84px] shrink-0 text-left"
          >
            <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-panel ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image(p)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-brand text-white shadow-sm transition-transform group-active:scale-90">
                <Plus className="size-4" strokeWidth={3} />
              </span>
            </span>
            <span className="mt-1 block truncate text-[10px] font-semibold tracking-wide text-brand uppercase">{label(p, finish)}</span>
            <span className="block truncate text-[11px] leading-tight text-snow/90">{shortName(p.name)}</span>
            <span className="block text-[11px] font-semibold text-snow">{formatINR(price)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
