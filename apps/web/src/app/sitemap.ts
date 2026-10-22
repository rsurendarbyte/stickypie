import type { MetadataRoute } from "next";
import { categoryPath, inCategory } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { generateStaticParams as legalSlugs } from "./legal/[slug]/page";
import { absoluteUrl, isProductionSite } from "@/lib/site";
import { SURFACES } from "@/lib/surfaces";

// Rendered per request so stickers added from the admin app appear without a
// redeploy (crawlers fetch it rarely, so this costs almost nothing).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isProductionSite()) return [];

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/stickers"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/custom-stickers"), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: absoluteUrl("/custom-stickers/design"), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: absoluteUrl("/qr-code-stickers"), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: absoluteUrl("/name-stickers"), changeFrequency: "monthly" as const, priority: 0.8 },
    ...SURFACES.map((s) => ({ url: absoluteUrl(`/${s.slug}`), changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.3 },
    ...legalSlugs().map(({ slug }) => ({
      url: absoluteUrl(`/legal/${slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  try {
    const driver = getDriver();
    const [products, categories] = await Promise.all([
      driver.listProducts({ activeOnly: true }),
      driver.listCategories(),
    ]);
    // Category pages that have stickers on sale.
    for (const category of categories) {
      if (!products.some((p) => inCategory(p, category.id))) continue;
      pages.push({ url: absoluteUrl(categoryPath(category.slug)), changeFrequency: "weekly", priority: 0.85 });
    }
    for (const product of products) {
      pages.push({
        url: absoluteUrl(`/sticker/${product.slug}`),
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
        images: [absoluteUrl(product.imageUrl)],
      });
    }
  } catch (err) {
    console.error("[sitemap] product list unavailable, serving static pages only:", err);
  }

  return pages;
}
