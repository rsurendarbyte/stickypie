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
import { visitSeed } from "./skin-seed";

const MARK = "~puzzle";
/** A puzzle card after every this many cards (and one first). */
const EVERY = 2;
/** One pick per visit, kept for every row on the page (and the same again on Back). */
const VISIT = visitSeed();

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

const catsOf = (p: Product) => (p.categoryIds?.length ? p.categoryIds : [p.categoryId]);

/**
 * `lead(list)`: the list with a puzzle poster card first and another after every
 * `EVERY` cards (`first: false` skips the opening one, for the later part of a
 * split grid). Rows with no posters to pick from stay as they are, and so does
 * everything when the puzzle is switched off.
 *
 * A puzzle card never shows a poster that is already a card in the row. Pass
 * the page's `used` set (every product already on the page) and it prefers
 * posters not on the page yet, adding its own picks to it. Once those run out
 * (the home rows hold nearly every poster) it takes posters shown elsewhere on
 * the page as cards, but never one an earlier puzzle card on the page showed;
 * only when every poster has been a puzzle card are puzzle cards left out.
 * Picks go, in order: the row's theme (posters in the same categories as its
 * single posters, or the posters inside its wall sets), then any poster.
 */
export function usePuzzleLead() {
  const features = useFeatures();
  const posters = usePosterCatalog();
  return useCallback(
    (list: Product[], { first = true, used }: { first?: boolean; used?: Set<string> } = {}): Product[] => {
      if (!features.posterPuzzle || list.length === 0 || posters.length === 0) return list;
      const byId = new Map(posters.map((p) => [p.id, p]));
      // in a row of (mostly) wall sets the puzzle card takes their shape, so rows (and the phone feed) keep one height
      const wide = list.filter(isPosterPack).length > list.length / 2;
      const inRow = new Set(list.map((p) => p.id));
      const singles = list.filter((p) => isSinglePoster(p) && byId.has(p.id));
      let theme = singles.length ? [] : list.filter(isPosterPack).flatMap((set) => set.packItems.flatMap((id) => byId.get(id) ?? []));
      if (!theme.length) {
        const cats = new Set(list.flatMap(catsOf));
        theme = posters.filter((p) => catsOf(p).some((c) => cats.has(c)));
      }
      const free = (p: Product) => !inRow.has(p.id) && !used?.has(p.id);
      // with the page's list: puzzle picks are also kept in it under this key, so no two puzzle cards match
      const asPuzzle = (id: string) => `${MARK}:${id}`;
      const notPuzzled = (p: Product) => !inRow.has(p.id) && !used?.has(asPuzzle(p.id));
      const unique = (l: Product[]) => [...new Map(l.map((p) => [p.id, p])).values()];
      // the theme's unused posters, then any unused poster, then (all shown) repeats outside the row
      const tiers = [
        unique(theme.filter(free)),
        posters.filter(free),
        unique(theme.filter(notPuzzled)),
        posters.filter(notPuzzled),
      ];
      if (!tiers[3].length) return list;
      // each tier walked from a random start: no repeats until it is used up
      const start = hash(list.map((p) => p.id).join());
      const picked = new Set<string>();
      const steps = tiers.map(() => 0);
      let round = 0;
      const next = (): Product | undefined => {
        for (let t = 0; t < tiers.length; t++) {
          const tier = tiers[t];
          while (steps[t] < tier.length) {
            const p = tier[(start + steps[t]++) % tier.length];
            // the first two tiers are "not on the page yet", the last two "not a puzzle card yet": skip what an earlier pick took
            if (picked.has(p.id) || (t < 2 ? used?.has(p.id) : used?.has(asPuzzle(p.id)))) continue;
            picked.add(p.id);
            used?.add(p.id);
            used?.add(asPuzzle(p.id));
            return p;
          }
        }
        // with the page's list: every poster has been a puzzle card already, so
        // leave the puzzle card out rather than show one twice
        if (used) return undefined;
        // every poster outside the row already picked in this row (a tiny shop): go round again
        const last = tiers[3];
        return last[(start + round++) % last.length];
      };
      const out: Product[] = [];
      const push = (n: number) => {
        const p = next();
        if (p) out.push(asPuzzleEntry(p, n, wide));
      };
      if (first) push(0);
      list.forEach((product, i) => {
        out.push(product);
        if ((i + 1) % EVERY === 0 && i < list.length - 1) push(out.length);
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
