// Google Merchant Center product feed (free Shopping listings).
// Add https://stickypie.in/feeds/google.xml as a scheduled feed in Merchant
// Center. Each size is its own item, grouped by sticker. Built once at deploy
// and served as a free static file; new stickers appear with the next deploy.
import { getDriver } from "@/lib/data";
import { HANDLING_DAYS, productDetails, seoName } from "@/lib/seo";
import { isPoster, isPosterPack, sizeChipLabel } from "@/lib/poster";
import { SITE_NAME, absoluteUrl, isProductionSite } from "@/lib/site";
import { isWallSetOnly, type Product } from "@stickypie/shared";

export const dynamic = "force-static";

const GOOGLE_CATEGORY =
  "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Crafting Materials > Embellishments & Trims > Decorative Stickers";

const GOOGLE_POSTER_CATEGORY = "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork";

/**
 * Merchant Center wants plain facts (up to 5,000 characters), not the 160-character
 * search snippet: the product's own words, then what it is, what it's made of and
 * where it goes. Sentences quoting a price are dropped (the price fields carry it,
 * and a stale ₹ in the text gets items flagged).
 */
function feedDescription(product: Product, categoryNames: string[]) {
  const d = productDetails(product, categoryNames);
  const own = product.description
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s && !/₹|\bRs\.?\s?\d|\bINR\b/i.test(s))
    .join(" ")
    .replace(/!/g, ".");
  const facts = d.facts.filter(([k]) => k !== "Price").map(([k, v]) => `${k}: ${v}.`);
  return [own, d.intro, ...facts, d.tips].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 4900);
}

/** Short bullet points Google shows on the listing (up to 10, 150 chars each). */
function highlights(product: Product, categoryNames: string[]) {
  return productDetails(product, categoryNames)
    .facts.filter(([k]) => k !== "Price")
    .map(([k, v]) => `${k}: ${v}`.slice(0, 150))
    .slice(0, 10);
}

/**
 * Google caps g:id at 50 characters. Ids that fit stay as they are (changing one
 * resets its review); longer ones keep their first 41 characters plus a short,
 * stable hash of the whole id.
 */
function feedId(id: string): string {
  if (id.length <= 50) return id;
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `${id.slice(0, 41).replace(/-+$/, "")}-${h.toString(36).padStart(7, "0").slice(0, 8)}`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  if (!isProductionSite()) return new Response("Not found", { status: 404 });

  const driver = getDriver();
  const [products, categories] = await Promise.all([
    // wall-set-only posters (calendar months…) are sold only inside their wall
    driver.listProducts({ activeOnly: true }).then((all) => all.filter((p) => !isWallSetOnly(p))),
    driver.listCategories(),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const items = products.flatMap((product) => {
    const sizes = product.sizes.length
      ? product.sizes
      : [{ inches: null as number | null, price: product.price, compareAtPrice: product.compareAtPrice }];
    const availability = product.stock === 0 ? "out_of_stock" : "in_stock";
    const poster = isPoster(product);
    const type = [poster ? "Posters" : "Stickers", catName.get(product.categoryId ?? "")].filter(Boolean).join(" > ");
    const pack = isPosterPack(product);
    const cats = product.categoryIds.map((id) => catName.get(id)).filter((n): n is string => !!n);
    const description = feedDescription(product, cats);
    const bullets = highlights(product, cats);
    const extraImage = product.displayUrl && product.displayUrl !== product.imageUrl ? product.displayUrl : null;
    return sizes.map((size) => {
      const sale = size.compareAtPrice && size.compareAtPrice > size.price;
      const fields: [string, string][] = [
        ["g:id", feedId(size.inches ? `${product.slug}-${size.inches}in` : product.slug)],
        ["g:item_group_id", product.slug],
        ["g:title", pack ? `${seoName(product)} – ${product.packItems.length} Posters` : `${seoName(product)}${size.inches ? ` – ${poster ? sizeChipLabel(product, size.inches) : size.inches} inch` : ""} | ${poster ? "Wall Poster" : "Die-Cut Vinyl"}`],
        ["g:description", description],
        // one link per size, opening the page on that size so its price matches
        ["g:link", absoluteUrl(`/sticker/${product.slug}${size.inches && sizes.length > 1 ? `?size=${size.inches}` : ""}`)],
        ["g:image_link", absoluteUrl(product.imageUrl)],
        ...(extraImage ? [["g:additional_image_link", absoluteUrl(extraImage)] as [string, string]] : []),
        ["g:availability", availability],
        ["g:price", `${(sale ? size.compareAtPrice! : size.price).toFixed(2)} INR`],
        ...(sale ? [["g:sale_price", `${size.price.toFixed(2)} INR`] as [string, string]] : []),
        ["g:brand", SITE_NAME],
        ["g:condition", "new"],
        ["g:identifier_exists", "no"],
        ["g:google_product_category", poster ? GOOGLE_POSTER_CATEGORY : GOOGLE_CATEGORY],
        ["g:product_type", type],
        ["g:material", pack ? "Poster Paper" : poster ? "Poster Paper" : "Vinyl"],
        ["g:min_handling_time", String(HANDLING_DAYS.min)],
        ["g:max_handling_time", String(HANDLING_DAYS.max)],
        ...bullets.map((b) => ["g:product_highlight", b] as [string, string]),
        ...(size.inches ? [["g:size", `${poster ? sizeChipLabel(product, size.inches) : size.inches} inch`] as [string, string]] : []),
      ];
      return `    <item>\n${fields.map(([k, v]) => `      <${k}>${xml(v)}</${k}>`).join("\n")}\n    </item>`;
    });
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(SITE_NAME)} stickers and wall posters</title>
    <link>${xml(absoluteUrl("/"))}</link>
    <description>${xml(`Die-cut vinyl stickers and wall posters from ${SITE_NAME}, shipped across India`)}</description>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
