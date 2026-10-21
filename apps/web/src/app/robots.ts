import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/mode";
import { isProductionSite } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite()) {
    // Non-production sites are kept out of search with noindex on every page
    // and response. Crawling is deliberately NOT blocked here: a crawler has to
    // fetch a page to see its noindex, and "Disallow: /" would leave any
    // already-discovered dev URLs stuck in search results.
    return { rules: { userAgent: "*", allow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/checkout", "/order/", "/pay/", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
