import type { Metadata } from "next";
import HomeClient from "@/components/home-client";
import JsonLd from "@/components/json-ld";
import { StoreAbout } from "@/components/seo-blocks";
import { SUPPORT_EMAIL } from "@stickypie/shared";
import { faqStructuredData, storeStructuredData } from "@/lib/seo";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { siteUrl } from "@/lib/mode";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
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
  return { ...base, title: { absolute: `Buy Vinyl Stickers Online in India | ${SITE_NAME} — ${SITE_TAGLINE}` } };
}

// Built as a static shell (free, unlimited on Cloudflare). Products load live
// in the browser (on-sale only), so nothing stale or off-sale is ever shown.
export default async function HomePage() {
  const driver = getDriver();
  const [categories, products, rails] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
    driver.getHomeRails(),
  ]);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl()}/stickers?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    storeStructuredData(SUPPORT_EMAIL),
    faqStructuredData(),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <div className="no-select">
        <HomeClient
          initial={{ categories, products: productSnapshot(products) }}
          initialRails={rails}
        />
      </div>
      <StoreAbout />
    </>
  );
}
