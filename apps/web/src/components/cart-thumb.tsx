"use client";

import type { Product } from "@stickypie/shared";
import { useLiveCatalog } from "@/lib/live-catalog";
import { wallSpots } from "@/lib/poster";
import type { CartItem } from "./cart-context";

const NO_CATALOG = { categories: [], products: [] };
const image = (p: Product) => p.thumbUrl ?? p.imageUrl;
const shortName = (name: string) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;

/** A customized wall's set and posters, worked out from what the cart line saved. */
function useCustomWall(item: CartItem) {
  const { products } = useLiveCatalog(NO_CATALOG);
  const spec = item.customSpec?.kind === "wall" ? item.customSpec : null;
  const set = products.find((p) => p.id === spec?.set);
  const byId = new Map(products.map((p) => [p.id, p]));
  return { set, ids: spec?.posters ?? [], byId };
}

/** The shopper's posters in their places, drawn from the cart line's poster list. */
function CustomWallThumb({ item, alt }: { item: CartItem; alt: string }) {
  const { set, ids, byId } = useCustomWall(item);
  const live = set
    ? wallSpots(set).flatMap((spot, i) => {
        const poster = byId.get(ids[i]);
        return poster ? [{ src: image(poster), ...spot }] : [];
      })
    : [];
  const posters = live.length ? live : (item.wallPreview ?? []);
  if (!posters.length) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.thumbUrl ?? item.imageUrl} alt={alt} className="size-full object-contain" />;
  }
  return (
    <span role="img" aria-label={alt} className="relative block size-full">
      {posters.map((poster, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={poster.src}
          alt=""
          className="absolute rounded-[1px] object-cover"
          style={{ left: `${poster.x}%`, top: `${poster.y}%`, width: `${poster.w}%`, height: `${poster.h}%` }}
        />
      ))}
    </span>
  );
}

/** A cart line's picture: for a customized wall, the shopper's own posters in their places. */
export default function CartThumb({ item, alt = "", lazy = false, className = "" }: { item: CartItem; alt?: string; lazy?: boolean; className?: string }) {
  if (item.customSpec?.kind === "wall" && item.customSpec.set) return <CustomWallThumb item={item} alt={alt} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.thumbUrl ?? item.imageUrl} alt={alt} loading={lazy ? "lazy" : undefined} decoding="async" className={className} />
  );
}

function SwappedPosters({ item }: { item: CartItem }) {
  const { set, ids, byId } = useCustomWall(item);
  if (!set) return null;
  const swapped = ids.filter((id) => !set.packItems.includes(id)).flatMap((id) => byId.get(id) ?? []);
  if (!swapped.length) return null;
  return (
    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fog">
      <span className="font-semibold text-snow/80">Swapped in: </span>
      {swapped.map((p) => shortName(p.name)).join(", ")}
    </p>
  );
}

/** Which posters the shopper put on a wall, under its name in the cart. */
export function WallPicksNote({ item }: { item: CartItem }) {
  return item.customSpec?.kind === "wall" && item.customSpec.set ? <SwappedPosters item={item} /> : null;
}
