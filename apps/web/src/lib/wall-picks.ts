// A shopper's own posters on a wall set, kept for this browser tab. The swipe view and
// the page below it share them, and they go into the cart as "Your picks".
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { lineKey, useCart, type CartProduct } from "@/components/cart-context";
import { CUSTOM_PRODUCT_PREFIX, isOwnPoster, packPosterSizes, packSizeSummary, type Product } from "@stickypie/shared";
import { ownPosterGone, useOwnPosters } from "./own-posters";
import { wallSpots } from "./poster";
import { posterImage } from "./poster-images";

const KEY = "stickypie.wall.picks";
const listeners = new Set<() => void>();

function load(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

let picks = load();

function save(next: Record<string, string[]>) {
  picks = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the picks last until the page closes
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shopper's posters for this set, or null while it is the set as sold. */
export function useWallPicks(productId: string): string[] | null {
  return useSyncExternalStore(subscribe, () => picks[productId] ?? null, () => null);
}

/** How many spots the shopper has emptied and not filled yet. */
export const wallGaps = (posters: string[] | null) => posters?.filter((id) => !id).length ?? 0;

/** Puts a poster on one spot, or empties it (""). */
export function pickPoster(product: Product, spot: number, posterId: string) {
  save({ ...picks, [product.id]: (picks[product.id] ?? product.packItems).map((id, i) => (i === spot ? posterId : id)) });
}

/** Swaps the posters on two spots. Each spot keeps its size, and every poster is sold in both. */
export const swapSpots = (posters: string[], a: number, b: number) => posters.map((id, i) => (i === a ? posters[b] : i === b ? posters[a] : id));

export function swapPosters(product: Product, a: number, b: number) {
  save({ ...picks, [product.id]: swapSpots(picks[product.id] ?? product.packItems, a, b) });
}

/** The whole wall at once, when the swipe view's arranging is done. */
export function setPosters(product: Product, posters: string[]) {
  save({ ...picks, [product.id]: posters });
}

function resetPicks(productId: string) {
  const { [productId]: _, ...rest } = picks;
  save(rest);
}

/** A set has one customized line in the cart, whichever posters are on it. */
export const wallLineId = (setId: string) => `${CUSTOM_PRODUCT_PREFIX}wall-${setId}`;

/** The cart line for a set with the shopper's posters: same wall, same price. */
function wallCartLine(product: Product, posters: string[], price: number): CartProduct {
  // An own poster's picture only lives on this page, so a saved cart line can't hold it.
  const ours = posters.filter((id) => !isOwnPoster(id));
  const first = (ours[0] && posterImage(ours[0])) ?? product.imageUrl;
  return {
    productId: wallLineId(product.id),
    size: null,
    sizeLabel: packSizeSummary(packPosterSizes(product)),
    slug: product.slug,
    name: `${product.name} · Your picks`,
    price,
    imageUrl: first,
    thumbUrl: first,
    stock: product.stock,
    custom: true,
    customKind: "wall",
    customSpec: { kind: "wall", layout: "set", posters, set: product.id },
    wallPreview: wallSpots(product).flatMap((spot, i) => {
      const src = isOwnPoster(posters[i]) ? null : posterImage(posters[i]);
      return src ? [{ src, ...spot }] : [];
    }),
  };
}

/**
 * The shopper's wall for a set, kept in step with the cart: the wall they have in the
 * cart is the wall they see, and a change on the wall changes that cart line.
 */
export function useWallLine(product: Product, price: number) {
  const { items, setLine, remove } = useCart();
  const posters = useWallPicks(product.id);
  const ownLoaded = useOwnPosters(posters);
  const gaps = wallGaps(posters);
  const line = posters ? wallCartLine(product, posters, price) : null;
  const inCart = items.find((item) => item.productId === wallLineId(product.id));
  const plain = items.find((item) => item.productId === product.id);
  const saved = inCart?.customSpec?.kind === "wall" ? inCart.customSpec.posters : null;

  useEffect(() => {
    if (saved && !posters) save({ ...picks, [product.id]: saved });
    else if (!line || gaps) return;
    // The plain set in the cart becomes the customized wall: the same line, same quantity.
    else if (plain && !inCart) setLine(line, lineKey(plain));
    else if (saved && posters?.join() !== saved.join()) setLine(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.join(), posters?.join(), Boolean(plain)]);

  // An own poster this browser no longer has: its spot opens up to be filled again.
  useEffect(() => {
    if (posters?.some(ownPosterGone)) save({ ...picks, [product.id]: posters.map((id) => (ownPosterGone(id) ? "" : id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownLoaded, posters?.join()]);

  const reset = () => {
    resetPicks(product.id);
    if (inCart) remove(lineKey(inCart));
  };
  return { posters, gaps, line, reset, inCart: Boolean(inCart) };
}
