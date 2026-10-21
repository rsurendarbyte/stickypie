import type { Metadata } from "next";
import { Suspense } from "react";
import BrowseClient from "@/components/browse-client";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { pageMetadata } from "@/lib/site";

// Static shell: products load live in the browser (on-sale only) and all
// search/filter/sort happens client-side (zero Worker requests).
// Filtered/search URLs (?category=, ?q=) all canonicalize to /browse.
export const metadata: Metadata = pageMetadata({
  title: "Browse all stickers",
  description:
    "Shop every StickyPie design — car and bike decals, origin badges, warning labels, memes and sticker packs. Waterproof die-cut vinyl, shipped across India.",
  path: "/browse",
});

export default async function BrowsePage() {
  const driver = getDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
  ]);

  return (
    <div className="min-h-screen w-full px-4 pt-24 pb-24 sm:px-8 lg:px-12 2xl:px-20">
      <Suspense
        fallback={
          <div className="grid min-h-[40vh] place-items-center">
            <div className="size-10 animate-spin rounded-full border-2 border-line border-t-brand" />
          </div>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} />
      </Suspense>
    </div>
  );
}
