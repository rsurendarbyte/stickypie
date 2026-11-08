// The hero's poster fan, drawn before anything else on the page. Its posters are
// built into the home page, so a new visitor sees them from the first HTML instead
// of waiting for the JS and the catalogue. Shared by the server page and the hero.
import type { Category, Product } from "@stickypie/shared";
import { isMiniPoster, isPosterPack } from "./poster";

/** Smoking and guns (checked by eye, not all say so in the name): still on sale, but never put forward on the banner. */
export const NOT_IN_HERO = /cigar|mala da|rajinikanth red and gold|boss dog|ajith kumar racing collage|masked heist/i;

export type FanPoster = Pick<Product, "id" | "slug" | "name" | "thumbUrl" | "displayUrl" | "imageUrl">;

/** Phones take the small file, even on a sharp screen; bigger screens the 1024px one. */
export const FAN_SIZES = "(min-width: 768px) 230px, 100px";

export function fanSrc(p: FanPoster) {
  const src = p.thumbUrl ?? p.imageUrl;
  return { src, srcSet: p.thumbUrl && p.displayUrl ? `${p.thumbUrl} 320w, ${p.displayUrl} 683w` : undefined };
}

/** Phones take the 240px file; a sharp big screen the 480px one (tiles are 92 to 170px). */
export function wallTileSrc(p: Pick<Product, "tinyUrl" | "thumbUrl" | "imageUrl">) {
  const src = p.thumbUrl ?? p.imageUrl;
  return p.tinyUrl
    ? { src, srcSet: `${p.tinyUrl} 240w, ${src} 480w`, sizes: "(min-width: 640px) 170px, 50px" }
    : { src };
}

/** Every poster the fan may show, each category spread evenly through the list so neighbours differ. */
export function fanSnapshot(products: Product[], categories: Category[]): FanPoster[] {
  const regionId = categories.find((c) => c.slug === "cities-states")?.id;
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    if (!isMiniPoster(p) || isPosterPack(p) || NOT_IN_HERO.test(p.name) || (regionId && p.categoryIds.includes(regionId))) continue;
    const key = p.categoryId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  // the k-th of n posters in a category sits at (k + 0.5) / n of the way along
  return [...groups.values()]
    .flatMap((g) => g.map((p, k) => ({ p, at: (k + 0.5) / g.length })))
    .sort((a, b) => a.at - b.at)
    .map(({ p }) => ({ id: p.id, slug: p.slug, name: p.name, thumbUrl: p.thumbUrl, displayUrl: p.displayUrl, imageUrl: p.imageUrl }));
}

/**
 * Runs while the page is still being read, right after the fan's cards: picks a
 * random start and points the cards at their pictures. The page itself is one
 * static file for everyone, and this keeps the first fan different on each visit.
 * window.__heroFan tells the hero which start was picked, so it draws the same ones.
 */
export function fanScript(posters: FanPoster[]) {
  const list = posters.map((p) => ({ slug: p.slug, ...fanSrc(p) }));
  const json = JSON.stringify(list).replace(/</g, "\\u003c");
  return `(function(){var p=${json},s=Math.floor(Math.random()*p.length),a=document.currentScript.parentNode.querySelectorAll("a[data-fan]");window.__heroFan=s;for(var i=0;i<a.length;i++){var q=p[(s+i)%p.length],m=a[i].querySelector("img");a[i].href="/sticker/"+q.slug;if(q.srcSet){m.sizes=${JSON.stringify(FAN_SIZES)};m.srcset=q.srcSet}m.src=q.src}})()`;
}
