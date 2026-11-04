import { ArrowRight } from "lucide-react";
import Link from "@/components/page-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import { Suspense } from "react";
import { categoryPath, categoryTitle, inCategory } from "@stickypie/shared";
import BrowseClient from "@/components/browse-client";
import StickerLoader from "@/components/sticker-loader";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { CategoryAbout } from "@/components/seo-blocks";
import { categoryIntro, itemListStructuredData } from "@/lib/seo";
import { absoluteUrl, pageMetadata } from "@/lib/site";

// One SEO page per category: /stickers/cars, /stickers/memes… Prerendered at
// build; categories added later from the admin render on demand.
// Stored in the R2 page cache once built (at deploy, or on the first visit
// for a category added later) and refreshed in the background at most every
// 10 minutes, so admin edits show up without a deploy.
export const revalidate = 600;

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
    description: /mini poster/i.test(category.name)
      ? `Shop ${title.toLowerCase()} at StickyPie: each as a 300 GSM wall poster or a vinyl sticker. Ships across India.`
      : /poster/i.test(category.name)
      ? `Shop ${title.toLowerCase()} at StickyPie: wall posters on 300 GSM poster paper, glue dots or double-sided tape included. Ships across India.`
      : `Shop ${title.toLowerCase()} at StickyPie: die-cut vinyl in several sizes for cars, bikes, laptops and more. Ships across India.`,
    path: categoryPath(category.slug),
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const { category, categories } = await findCategory(slug);
  if (!category) notFound();
  const products = await getDriver().listProducts({ activeOnly: true });
  const inThis = products.filter((p) => inCategory(p, category.id));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Stickers", item: absoluteUrl("/stickers") },
      { "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(categoryPath(category.slug)) },
    ],
  };

  return (
    <div className="min-h-screen w-full px-4 pt-[76px] pb-24 sm:px-8 sm:pt-24 lg:px-12 2xl:px-20">
      <JsonLd data={[breadcrumbLd, itemListStructuredData(inThis)]} />
      {/poster/i.test(category.name) && (
        <Link
          href="/wall-builder"
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/[0.07] px-4 py-3"
        >
          <span>
            <span className="block font-display text-base font-bold">Build your own wall</span>
            <span className="block text-xs text-fog">Pick a layout, choose every poster</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-brand" />
        </Link>
      )}
      <Suspense
        fallback={
          <div className="grid min-h-[40vh] place-items-center">
            <StickerLoader size={56} />
          </div>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} categorySlug={category.slug} />
      </Suspense>
      <CategoryAbout heading={`About our ${categoryTitle(category.name).toLowerCase()}`} text={categoryIntro(category, inThis.length)} />
    </div>
  );
}
