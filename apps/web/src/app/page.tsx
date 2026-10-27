import type { Metadata } from "next";
import HomeClient from "@/components/home-client";
import JsonLd from "@/components/json-ld";
import { StoreAbout } from "@/components/seo-blocks";
import { SUPPORT_EMAIL } from "@stickypie/shared";
import { faqStructuredData, storeFaq, storeStructuredData } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { siteUrl } from "@/lib/mode";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  pageMetadata,
} from "@/lib/site";

export function generateMetadata(): Metadata {
  // Home shares the brand card, not a rotating sticker.
  const base = pageMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    path: "/",
  });
  return { ...base, title: { absolute: `Buy Vinyl Stickers Online in India | ${SITE_NAME} — ${SITE_TAGLINE}` } };
}

// Built as a static shell (free, unlimited on Cloudflare). Products load live
// in the browser (on-sale only), so nothing stale or off-sale is ever shown.
export default async function HomePage() {
  const driver = getDriver();
  const [categories, products, rails, facts] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
    driver.getHomeRails(),
    loadShopFacts(),
  ]);
  const faq = storeFaq(facts);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: ["StickyPie Stickers", "stickypie.in"],
      url: siteUrl(),
      publisher: { "@id": `${siteUrl()}/#store` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl()}/stickers?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    storeStructuredData(SUPPORT_EMAIL),
    faqStructuredData(faq),
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
      <StoreAbout faq={faq} />
    </>
  );
}
