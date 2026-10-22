import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categoryPath, categoryTitle } from "@stickypie/shared";
import BrowseClient from "@/components/browse-client";
import StickerLoader from "@/components/sticker-loader";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { absoluteUrl, jsonLd, pageMetadata } from "@/lib/site";

// One SEO page per category: /stickers/cars, /stickers/memes… Prerendered at
// build; categories added later from the admin render on demand.
export async function generateStaticParams() {
  const categories = await getDriver().listCategories();
  return categories.map((c) => ({ category: c.slug }));
}

async function findCategory(slug: string) {
  const categories = await getDriver().listCategories();
  return { category: categories.find((c) => c.slug === slug) ?? null, categories };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const { category } = await findCategory(slug);
  if (!category) return {};
  const title = categoryTitle(category.name);
  return pageMetadata({
    title: `${title} — Buy Online in India`,
    description: `Shop ${title.toLowerCase()} at StickyPie: waterproof die-cut vinyl in 3″, 6″ and 7″ sizes for cars, bikes, laptops and more. Ships across India.`,
    path: categoryPath(category.slug),
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const { category, categories } = await findCategory(slug);
  if (!category) notFound();
  const products = await getDriver().listProducts({ activeOnly: true });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Stickers", item: absoluteUrl("/stickers") },
      { "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(categoryPath(category.slug)) },
    ],
  };

  return (
    <div className="min-h-screen w-full px-4 pt-24 pb-24 sm:px-8 lg:px-12 2xl:px-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />
      <Suspense
        fallback={
          <div className="grid min-h-[40vh] place-items-center">
            <StickerLoader size={56} />
          </div>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} categorySlug={category.slug} />
      </Suspense>
    </div>
  );
}
