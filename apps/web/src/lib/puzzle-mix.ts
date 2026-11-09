"use client";

// Puzzle poster cards in product rows and grids: each row opens with a card
// selling a mini poster as a puzzle poster (9 cards, its own price), and more
// come between its cards. The posters are picked at random from the row's own theme (a car row shows a car poster,
// a travel row a travel one), new on every visit. An entry is the poster's
// product under a marked id, so lists keep unique keys and ProductCard knows to
// draw the puzzle card.
import { useCallback } from "react";
import type { Product } from "@stickypie/shared";
import { useFeatures } from "./live-catalog";
import { usePosterCatalog } from "@/components/wall-size-map";
import { isPosterPack, isSinglePoster } from "./poster";

const MARK = "~puzzle";
/** A puzzle card after every this many cards (and one first). */
const EVERY = 2;
/** One random pick per visit, kept for every row on the page. */
const VISIT = Math.floor(Math.random() * 1e9);

export const isPuzzleEntry = (product: Product) => product.id.includes(MARK);
/** A puzzle entry in a row of wall sets: drawn in the wall card's shape. */
export const isWidePuzzleEntry = (product: Product) => product.id.includes(`${MARK}w`);
/** The poster behind a puzzle entry (its real id, for the cart). */
export const puzzleProduct = (entry: Product): Product => ({ ...entry, id: entry.id.slice(0, entry.id.indexOf(MARK)) });
/** A poster as a puzzle entry (`n` keeps keys unique in one list; `wide` = among wall sets). */
export const asPuzzleEntry = (poster: Product, n = 0, wide = false): Product => ({ ...poster, id: `${poster.id}${MARK}${wide ? "w" : ""}${n}` });

function hash(text: string): number {
  let h = VISIT;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * `lead(list)`: the list with a puzzle poster card first and another after every
 * `EVERY` cards (`first: false` skips the opening one, for the later part of a
 * split grid). Their posters come from the row itself: its single posters, else
 * the posters inside its wall sets, else posters in the same categories. Rows
 * with none of those stay as they are, and so does everything when the puzzle
 * is switched off.
 */
export function usePuzzleLead() {
  const features = useFeatures();
  const posters = usePosterCatalog();
  return useCallback(
    (list: Product[], { first = true }: { first?: boolean } = {}): Product[] => {
      if (!features.posterPuzzle || list.length === 0 || posters.length === 0) return list;
      const byId = new Map(posters.map((p) => [p.id, p]));
      // in a row of (mostly) wall sets the puzzle card takes their shape, so rows (and the phone feed) keep one height
      const wide = list.filter(isPosterPack).length > list.length / 2;
      let pool = list.filter((p) => isSinglePoster(p) && byId.has(p.id));
      if (!pool.length) pool = list.filter(isPosterPack).flatMap((set) => set.packItems.flatMap((id) => byId.get(id) ?? []));
      if (!pool.length) {
        const cats = new Set(list.flatMap((p) => (p.categoryIds?.length ? p.categoryIds : [p.categoryId])));
        pool = posters.filter((p) => (p.categoryIds?.length ? p.categoryIds : [p.categoryId]).some((c) => cats.has(c)));
      }
      pool = [...new Map(pool.map((p) => [p.id, p])).values()];
      if (!pool.length) return list;
      // walk the theme's posters from a random start: no repeats until all are used
      let at = hash(list.map((p) => p.id).join()) % pool.length;
      const next = () => pool[at++ % pool.length];
      const out: Product[] = first ? [asPuzzleEntry(next(), 0, wide)] : [];
      list.forEach((product, i) => {
        out.push(product);
        if ((i + 1) % EVERY === 0 && i < list.length - 1) out.push(asPuzzleEntry(next(), out.length, wide));
      });
      return out;
    },
    [features.posterPuzzle, posters],
  );
}

/**
 * The phone swipe view's list with puzzle posters dropped in every 3 to 5
 * stickers (never before the one the shopper opened). Each is a poster near
 * that spot when there is one (same category), else any poster; no repeats close
 * together. `seed` decides the gaps and picks, so they stay put while swiping.
 */
export function withPuzzles(list: Product[], seed: number, on: boolean): Product[] {
  if (!on) return list;
  const posters = list.filter(isSinglePoster);
  if (posters.length < 3) return list;
  let r = seed || 1;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out: Product[] = [];
  const recent: string[] = [];
  let next = 3 + Math.floor(rand() * 3);
  list.forEach((product, i) => {
    out.push(product);
    if (i + 1 < next || i === list.length - 1) return;
    next = i + 1 + 3 + Math.floor(rand() * 3);
    // a poster from around here first (it shares the row's category), then any
    const near = list.slice(Math.max(0, i - 6), i + 7).filter((p) => isSinglePoster(p) && !recent.includes(p.id));
    const pool = near.length ? near : posters.filter((p) => !recent.includes(p.id));
    if (!pool.length) return;
    const pick = pool[Math.floor(rand() * pool.length)];
    recent.push(pick.id);
    if (recent.length > 10) recent.shift();
    out.push(asPuzzleEntry(pick, out.length));
  });
  return out;
}
