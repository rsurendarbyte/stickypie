import type { Metadata } from "next";
import HomeClient from "@/components/home-client";
import { getDriver } from "@/lib/data";
import { siteUrl } from "@/lib/mode";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  absoluteUrl,
  jsonLd,
  pageMetadata,
} from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const products = await getDriver().listProducts({ activeOnly: true });
  const hero = products.find((p) => p.featured) ?? products[0];
  const base = pageMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    path: "/",
    image: hero?.imageUrl,
  });
  return { ...base, title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE} | Vinyl Stickers India` } };
}

// Built as a static shell (free, unlimited on Cloudflare) with a build-time
// catalog snapshot; in the browser it refreshes live from the Supabase API,
// so stock/prices/new drops stay current without a redeploy.
export default async function HomePage() {
  const driver = getDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
  ]);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl()}/browse?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl(),
      logo: absoluteUrl("/icon.svg"),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <HomeClient initial={{ categories, products }} />
    </>
  );
}
