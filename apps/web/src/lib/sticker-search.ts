// Sticker search for the search pop-up and the Stickers page, in the browser
// (no server request). Never a dead end: exact matches first; with none, the
// closest stickers (spelling slips, plurals, related words); with nothing
// close either, popular picks — so a search always leads to stickers to buy.
import type { Category, Product } from "@stickypie/shared";

/** Related words people search with → words that appear on our stickers. */
const RELATED: Record<string, string[]> = {
  bike: ["biker", "motorcycle", "rider", "ride", "helmet", "enfield"],
  motorcycle: ["bike", "biker", "rider", "enfield"],
  helmet: ["bike", "biker", "rider"],
  car: ["cars", "jdm", "racing", "petrolhead", "turbo", "drift"],
  racing: ["race", "f1", "racer", "motorsport"],
  jeep: ["4x4", "offroad", "thar", "off-road"],
  offroad: ["4x4", "jeep", "thar", "off-road", "adventure"],
  god: ["devotional", "spiritual", "shiva", "mahadev", "ganesha", "hanuman", "temple", "balaji"],
  shiva: ["mahadev", "bholenath", "devotional"],
  ganpati: ["ganesha", "vinayaka"],
  bajrang: ["hanuman"],
  funny: ["fun", "meme", "memes"],
  meme: ["funny", "fun", "memes"],
  quote: ["motivational", "inspirational", "quotes"],
  motivation: ["motivational", "inspirational", "hustle"],
  gym: ["fitness", "workout", "boxing"],
  code: ["coding", "developer", "programmer", "computer", "hacker", "debugging"],
  coding: ["code", "developer", "programmer", "computer"],
  programmer: ["developer", "coding", "code"],
  poster: ["mini poster", "posters"],
  travel: ["trip", "road trip", "wanderlust", "adventure"],
  trip: ["travel", "road trip"],
  india: ["indian", "desi", "bharat"],
  mountain: ["mountains", "hills", "adventure", "nature"],
  beach: ["goa", "sea", "coast"],
  dog: ["dogs", "pets", "animals", "puppy"],
  cat: ["cats", "kitten", "pets", "animals"],
  baby: ["baby on board", "kid"],
  bottle: ["water bottle"],
  cute: ["kawaii", "aesthetic"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
const words = (s: string) => norm(s).split(/[\s-]+/).filter(Boolean);
const singular = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

/** Edit distance, stopping early once it's clearly too far. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How well one search word fits one sticker's words (0 = not at all). */
function fit(word: string, tokens: string[], typos = true): number {
  const w = singular(word);
  let best = 0;
  for (const t of tokens) {
    const s = singular(t);
    if (s === w) return 4;
    if (w.length >= 3 && s.startsWith(w)) best = Math.max(best, 3);
    else if (w.length >= 4 && (s.includes(w) || (s.length >= 3 && w.startsWith(s)))) best = Math.max(best, 2);
    else if (typos && w.length >= 4) {
      // one slip ("porshe") nearly as good as a match; two only for long words
      const d = distance(w, s, w.length >= 7 ? 2 : 1);
      if (d === 1) best = Math.max(best, 3);
      else if (d === 2) best = Math.max(best, 2);
    }
  }
  return best;
}

export type SearchResult = {
  /** Stickers matching every word of the search. */
  exact: Product[];
  /** Related stickers that aren't exact matches (spelling slips, related
   *  words), best first: "More like this" under the matches, or "You might
   *  like" when there are none. */
  related: Product[];
  /** With nothing exact or related: popular picks. */
  popular: Product[];
};

/** A related sticker must score at least this (a prefix or two near-misses). */
const MIN_RELATED = 3;

export function searchStickers(products: Product[], categories: Category[], query: string, limit = 24): SearchResult {
  const q = norm(query).trim();
  if (!q) return { exact: [], related: [], popular: [] };
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const qWords = words(q);

  const tokensOf = (p: Product) => {
    const cats = (p.categoryIds ?? [p.categoryId]).map((id) => catName.get(id ?? "") ?? "").join(" ");
    return words(`${p.name} ${p.tags.join(" ")} ${cats}`);
  };
  // Typo matching only for words no sticker actually has ("lord" is a real
  // word on our stickers, so it shouldn't also pull in "ford").
  const known = new Set(qWords.filter((w) => products.some((p) => fit(w, tokensOf(p), false) >= 3)));

  const scored = products.map((p) => {
    const name = p.name.toLowerCase();
    const cats = (p.categoryIds ?? [p.categoryId]).map((id) => catName.get(id ?? "") ?? "").join(" ");
    const hay = `${name} ${p.tags.join(" ").toLowerCase()} ${cats.toLowerCase()}`;
    const tokens = words(hay);
    // exact: the old rule (every word appears somewhere), name hits first
    const exact = qWords.every((w) => hay.includes(w) || hay.includes(singular(w)))
      ? name.startsWith(q) ? 3 : name.includes(q) ? 2 : 1
      : 0;
    // close: each word scored on its own, related words count a little less
    let close = 0;
    for (const w of qWords) {
      let best = fit(w, tokens, !known.has(w));
      for (const r of RELATED[singular(w)] ?? RELATED[w] ?? []) best = Math.max(best, Math.min(3, fit(r, tokens, false)));
      close += best;
    }
    return { p, exact, close };
  });

  const exact = scored.filter((x) => x.exact > 0).sort((a, b) => b.exact - a.exact).map((x) => x.p);
  const others = scored.filter((x) => x.exact === 0);
  const top = Math.max(0, ...others.map((x) => x.close));
  // keep only clearly related stickers: a real hit, and not far behind the best
  const related = others
    .filter((x) => x.close >= MIN_RELATED && x.close >= top / 2)
    .sort((a, b) => b.close - a.close)
    .slice(0, limit)
    .map((x) => x.p);
  if (exact.length || related.length) return { exact, related, popular: [] };
  return { exact: [], related: [], popular: popularPicks(products, limit) };
}

/** Featured stickers first, then the newest. */
export function popularPicks(products: Product[], limit = 12): Product[] {
  const featured = products.filter((p) => p.featured);
  const rest = products.filter((p) => !p.featured);
  return [...featured, ...rest].slice(0, limit);
}
