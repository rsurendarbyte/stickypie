// Google Merchant Center product feed (free Shopping listings).
// Add https://stickypie.in/feeds/google.xml as a scheduled feed in Merchant
// Center. Each size is its own item, grouped by sticker. Built once at deploy
// and served as a free static file; new stickers appear with the next deploy.
import { getDriver } from "@/lib/data";
import { productSeoDescription, seoName } from "@/lib/seo";
import { isPoster, isPosterPack, sizeChipLabel } from "@/lib/poster";
import { SITE_NAME, absoluteUrl, isProductionSite } from "@/lib/site";

export const dynamic = "force-static";

const GOOGLE_CATEGORY =
  "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Crafting Materials > Embellishments & Trims > Decorative Stickers";

const GOOGLE_POSTER_CATEGORY = "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork";

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
    driver.listProducts({ activeOnly: true }),
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
    return sizes.map((size) => {
      const sale = size.compareAtPrice && size.compareAtPrice > size.price;
      const fields: [string, string][] = [
        ["g:id", size.inches ? `${product.slug}-${size.inches}in` : product.slug],
        ["g:item_group_id", product.slug],
        ["g:title", pack ? `${seoName(product)} – ${product.packItems.length} Posters` : `${seoName(product)}${size.inches ? ` – ${poster ? sizeChipLabel(product, size.inches) : size.inches} inch` : ""} | ${poster ? "Wall Poster" : "Die-Cut Vinyl"}`],
        ["g:description", productSeoDescription(product)],
        ["g:link", absoluteUrl(`/sticker/${product.slug}`)],
        ["g:image_link", absoluteUrl(product.imageUrl)],
        ["g:availability", availability],
        ["g:price", `${(sale ? size.compareAtPrice! : size.price).toFixed(2)} INR`],
        ...(sale ? [["g:sale_price", `${size.price.toFixed(2)} INR`] as [string, string]] : []),
        ["g:brand", SITE_NAME],
        ["g:condition", "new"],
        ["g:identifier_exists", "no"],
        ["g:google_product_category", poster ? GOOGLE_POSTER_CATEGORY : GOOGLE_CATEGORY],
        ["g:product_type", type],
        ["g:material", pack ? "Poster Paper" : poster ? "Poster Paper or Vinyl" : "Vinyl"],
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
