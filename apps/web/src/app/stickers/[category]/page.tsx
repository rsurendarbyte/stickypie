import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import { Suspense } from "react";
import { categoryPath, categoryTitle, inCategory } from "@stickypie/shared";
import BrowseClient from "@/components/browse-client";
import StickerLoader from "@/components/sticker-loader";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { isSinglePoster } from "@/lib/poster";
import { CategoryAbout, PosterTopics, ProductLinks } from "@/components/seo-blocks";
import { categoryIntro, itemListStructuredData } from "@/lib/seo";
import { absoluteUrl, pageMetadata, MIN_INDEXED_CATEGORY } from "@/lib/site";
import { activeProducts, allCategories } from "@/lib/page-data";

// One SEO page per category: /stickers/cars, /stickers/memes… Prerendered at
// build; categories added later from the admin render on demand.
// Stored in the R2 page cache once built (at deploy, or on the first visit
// for a category added later) and refreshed in the background at most every
// 10 minutes, so admin edits show up without a deploy.
export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await allCategories();
  return categories.map((c) => ({ category: c.slug }));
}

async function findCategory(slug: string) {
  const categories = await allCategories();
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
  const count = (await activeProducts()).filter((p) => inCategory(p, category.id)).length;
  return pageMetadata({
    title: `${title} — Buy Online in India`,
    description: /mini poster/i.test(category.name)
      ? `Shop ${title.toLowerCase()} at StickyPie: each as a wall poster or a 9-card puzzle poster. Ships across India.`
      : /poster/i.test(category.name)
      ? `Shop ${title.toLowerCase()} at StickyPie: wall posters on premium poster paper, glue dots or double-sided tape included. Ships across India.`
      : `Shop ${title.toLowerCase()} at StickyPie: die-cut vinyl in several sizes for cars, bikes, laptops and more. Ships across India.`,
    path: categoryPath(category.slug),
    // too few products to be a useful result yet (see MIN_INDEXED_CATEGORY)
    noindex: count < MIN_INDEXED_CATEGORY,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const { category, categories } = await findCategory(slug);
  if (!category) notFound();
  const products = await activeProducts();
  const inThis = products.filter((p) => inCategory(p, category.id));
  const posters = /poster/i.test(category.name);
  // The Walls page sells single posters too, drawn in the browser like its sets.
  const singles = category.slug === "poster-packs" ? products.filter(isSinglePoster) : [];
  const heading = category.slug === "poster-packs" ? "Wall posters" : categoryTitle(category.name);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      posters
        ? { "@type": "ListItem", position: 1, name: "Wall Posters", item: absoluteUrl("/wall-posters") }
        : { "@type": "ListItem", position: 1, name: "Stickers", item: absoluteUrl("/stickers") },
      { "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(categoryPath(category.slug)) },
    ],
  };

  return (
    <div className="min-h-screen w-full px-4 pt-[76px] pb-24 sm:px-8 sm:pt-24 lg:px-12 2xl:px-20">
      <JsonLd data={[breadcrumbLd, itemListStructuredData(singles.length ? [...inThis.slice(0, 25), ...singles.slice(0, 25)] : inThis)]} />
      <Suspense
        fallback={
          // The page's own HTML: the grid is drawn in the browser, so the heading search engines read is here.
          <>
            <h1 className="font-display text-2xl font-bold sm:text-4xl">{heading}</h1>
            <div className="grid min-h-[40vh] place-items-center">
              <StickerLoader size={56} />
            </div>
          </>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} categorySlug={category.slug} />
      </Suspense>
      <CategoryAbout
        heading={`About our ${categoryTitle(category.name).toLowerCase()}`}
        text={`${categoryIntro(category, inThis.length)}${singles.length ? ` Want just one? Pick from ${singles.length} single posters, each as a wall poster or a 9-card puzzle poster.` : ""}`}
      />
      {posters && <PosterTopics className="mt-4" />}
      <ProductLinks heading={`All ${categoryTitle(category.name).toLowerCase()}`} products={inThis} />
      <ProductLinks heading="All single posters" products={singles} />
    </div>
  );
}
