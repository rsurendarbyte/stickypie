// The hero's poster fan, drawn before anything else on the page. A few starting
// picks are built into the home page, so a new visitor sees them from the first HTML
// instead of waiting for the JS and the catalogue; the full list comes from the
// catalogue the page loads anyway. Shared by the server page and the hero.
import type { Category, Product } from "@stickypie/shared";
import { isMiniPoster, isPosterPack } from "./poster";

/** Smoking and guns (checked by eye, not all say so in the name): still on sale, but never put forward on the banner. */
export const NOT_IN_HERO = /cigar|mala da|rajinikanth red and gold|boss dog|ajith kumar racing collage|masked heist/i;

export type FanPoster = Pick<Product, "id" | "slug" | "name" | "tinyUrl" | "thumbUrl" | "displayUrl" | "imageUrl">;

/** Phones take the 240px tiny file (about 8 KB, the same one blurred behind the card,
 *  so one download), even on a sharp screen; bigger screens the 1024px one. */
export const FAN_SIZES = "(min-width: 768px) 230px, 80px";

export function fanSrc(p: FanPoster) {
  const src = p.thumbUrl ?? p.imageUrl;
  const sizes = [p.tinyUrl && `${p.tinyUrl} 240w`, p.thumbUrl && `${p.thumbUrl} 320w`, p.displayUrl && `${p.displayUrl} 683w`].filter(Boolean);
  return { src, srcSet: sizes.length > 1 ? sizes.join(", ") : undefined };
}

/** Phones take the 240px file; a sharp big screen the 480px one (tiles are 92 to 170px). */
export function wallTileSrc(p: Pick<Product, "tinyUrl" | "thumbUrl" | "imageUrl">) {
  const src = p.thumbUrl ?? p.imageUrl;
  return p.tinyUrl
    ? { src, srcSet: `${p.tinyUrl} 240w, ${src} 480w`, sizes: "(min-width: 640px) 170px, 50px" }
    : { src };
}

/** Every poster the fan may show, each category spread evenly through the list so
 *  neighbours differ. Same catalogue, same order, on the server and in the browser. */
export function fanOrder(products: Product[], categories: Category[]): FanPoster[] {
  const regionId = categories.find((c) => c.slug === "cities-states")?.id;
  const posters = [...products]
    .sort((x, y) => (x.slug < y.slug ? -1 : 1))
    .filter((p) => isMiniPoster(p) && !isPosterPack(p) && !NOT_IN_HERO.test(p.name) && !(regionId && p.categoryIds.includes(regionId)));
  // Grouped by subject (travel, devotional, cars...): a category on most posters, like
  // Mini posters itself, says nothing about the picture, so it's skipped.
  const count = new Map<string, number>();
  for (const p of posters) for (const id of p.categoryIds) count.set(id, (count.get(id) ?? 0) + 1);
  const groups = new Map<string, Product[]>();
  for (const p of posters) {
    const key = p.categoryIds.find((id) => (count.get(id) ?? 0) <= posters.length / 2) ?? p.categoryId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  // the k-th of n posters in a category sits at (k + 0.5) / n of the way along
  return [...groups.values()]
    .flatMap((g) => g.map((p, k) => ({ p, at: (k + 0.5) / g.length })))
    .sort((a, b) => a.at - b.at)
    .map(({ p }) => ({ id: p.id, slug: p.slug, name: p.name, tinyUrl: p.tinyUrl, thumbUrl: p.thumbUrl, displayUrl: p.displayUrl, imageUrl: p.imageUrl }));
}

/** How many first fans the page carries, three posters each, spread through the list. */
const FAN_STARTS = 6;

/** What the page itself carries: a few first fans, so it stays small. */
export function fanSnapshot(products: Product[], categories: Category[]): FanPoster[] {
  const all = fanOrder(products, categories);
  if (all.length < FAN_STARTS * 3) return all.slice(0, all.length - (all.length % 3));
  const step = Math.floor(all.length / FAN_STARTS);
  return Array.from({ length: FAN_STARTS }, (_, g) => all.slice(g * step, g * step + 3)).flat();
}

/**
 * Runs while the page is still being read, right after the fan's cards: picks one of
 * the first fans at random and points the cards at their pictures (the tiny one blurred
 * behind, the sharp one fading in over it once it has loaded). The page itself is one
 * static file for everyone, and this keeps the first fan different on each visit.
 * window.__heroFan tells the hero which poster it started from, so it goes on from there.
 */
export function fanScript(posters: FanPoster[]) {
  const list = posters.map((p) => ({ slug: p.slug, t: p.tinyUrl ?? undefined, ...fanSrc(p) }));
  const json = JSON.stringify(list).replace(/</g, "\\u003c");
  return `(function(){var p=${json},r=window.__visitSeed?((window.__visitSeed*9301+49297)%233280)/233280:Math.random(),s=3*Math.floor(r*p.length/3),a=document.currentScript.parentNode.querySelectorAll("a[data-fan]");window.__heroFan=p[s].slug;for(var i=0;i<a.length;i++){var q=p[s+i],m=a[i].querySelector("img"),b=a[i].querySelector("[data-fan-blur]");a[i].href="/sticker/"+q.slug;if(q.t&&b)b.style.backgroundImage="url("+q.t+")";m.onload=function(){this.setAttribute("data-loaded","")};if(q.srcSet){m.sizes=${JSON.stringify(FAN_SIZES)};m.srcset=q.srcSet}m.src=q.src;if(m.complete&&m.naturalWidth)m.setAttribute("data-loaded","")}})()`;

}
