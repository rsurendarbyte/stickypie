import type { Metadata } from "next";
import { Suspense } from "react";
import JsonLd from "@/components/json-ld";
import BrowseClient from "@/components/browse-client";
import StickerLoader from "@/components/sticker-loader";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { itemListStructuredData } from "@/lib/seo";
import { pageMetadata } from "@/lib/site";

// All stickers. Static shell: products load live in the browser (on-sale
// only) and search/sort happen client-side. ?q= and ?sort= canonicalize here.
export const metadata: Metadata = pageMetadata({
  title: "Buy Stickers Online in India – Car, Bike & Laptop Vinyl Stickers",
  description:
    "Shop every StickyPie sticker — car and bike decals, laptop stickers, origin badges, warning labels and memes. Waterproof die-cut vinyl in several sizes, shipped across India.",
  path: "/stickers",
});

export default async function StickersPage() {
  const driver = getDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
  ]);

  return (
    <div className="min-h-screen w-full px-4 pt-24 pb-24 sm:px-8 lg:px-12 2xl:px-20">
      <JsonLd data={itemListStructuredData(products)} />
      <Suspense
        fallback={
          <div className="grid min-h-[40vh] place-items-center">
            <StickerLoader size={56} />
          </div>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} />
      </Suspense>
    </div>
  );
}
