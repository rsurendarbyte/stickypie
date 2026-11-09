// "What's next" for a poster or sticker: the ones most like it first, in a
// fresh order on every visit, then the rest (also mixed), never just the newest
// drops. Used by the swipe view, the page view's Next and "More like this".
import type { Product } from "@stickypie/shared";

// Tags nearly every product carries (where a mini poster can go, what it is): they say nothing about likeness.
const GENERIC = new Set(["car", "bike", "laptop", "bottle", "helmet", "fridge", "wall", "poster", "mini poster", "poster pack", "sticker", "stickers", "art", "decal"]);

const tagsOf = (p: Product) => [...new Set(p.tags.map((t) => t.toLowerCase().trim()))].filter((t) => t && !GENERIC.has(t));

/** A steady 0–1 number for (seed, id): the same visit keeps its order, the next visit gets another. */
function chance(seed: number, id: string): number {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * `candidates` ordered for someone looking at `current`: shared tags count (a
 * rare one like "dhoni" far more than a common one like "india"), shared small
 * categories too; tags or categories most of the list has are ignored. Close
 * matches come first, shuffled a little by `seed`; the rest follow in a random order.
 */
export function relatedOrder(current: Product, candidates: Product[], seed: number): Product[] {
  const n = Math.max(candidates.length, 1);
  const tagCount = new Map<string, number>();
  const catCount = new Map<string, number>();
  for (const p of candidates) {
    for (const t of tagsOf(p)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    for (const c of p.categoryIds ?? []) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  }
  const mine = tagsOf(current);
  const myCats = current.categoryIds ?? [];
  const score = (p: Product) => {
    const theirs = new Set(tagsOf(p));
    let s = 0;
    for (const t of mine) {
      const f = tagCount.get(t) ?? 0;
      if (theirs.has(t) && f > 0 && f / n <= 0.4) s += Math.log(n / f) + 0.5;
    }
    for (const c of myCats) {
      const f = catCount.get(c) ?? 0;
      if ((p.categoryIds ?? []).includes(c) && f / n <= 0.4) s += 1.5;
    }
    return s;
  };
  const scored = candidates.map((p) => ({ p, s: score(p), r: chance(seed, p.id) }));
  const close = scored.filter((x) => x.s > 0).sort((a, b) => b.s * (0.65 + 0.7 * b.r) - a.s * (0.65 + 0.7 * a.r));
  const rest = scored.filter((x) => x.s <= 0).sort((a, b) => a.r - b.r);
  return [...close, ...rest].map((x) => x.p);
}
