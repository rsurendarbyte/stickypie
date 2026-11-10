import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preconnect, preload } from "react-dom";
import JsonLd from "@/components/json-ld";
import { MetaViewContent } from "@/components/meta-track";
import ProductDetailClient from "@/components/product-detail-client";
import StickerReel from "@/components/sticker-reel";
import { ProductAbout } from "@/components/seo-blocks";
import ProductAboutChoice from "@/components/product-about-choice";
import { isMiniPoster, isPosterPack, isWallSetup } from "@/lib/poster";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { relatedOrder } from "@/lib/related";
import { getDriver } from "@/lib/data";
import { allCategories, productBySlug } from "@/lib/page-data";
import {
  productDetails,
  productSeoDescription,
  productSeoTitle,
  productStructuredData,
} from "@/lib/seo";
import { pageMetadata } from "@/lib/site";
import { shareImageUrl } from "@/lib/share-links";

// Every active product page is prerendered at build time (free static asset
// on Cloudflare) and then refreshes its stock/price live from Supabase in the
// browser. Products added after the last deploy still render on demand.
// Stored in the R2 page cache once built (at deploy, or on the first visit
// for a sticker added later) and refreshed in the background at most every
// hour, so admin edits show up without a deploy (prices and stock are
// already live in the browser, so a slower refresh costs shoppers nothing).
export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await getDriver().listProducts({ activeOnly: true });
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product || !product.isActive) return { title: "Sticker" };
  return pageMetadata({
    title: productSeoTitle(product),
    description: productSeoDescription(product),
    path: `/sticker/${product.slug}`,
    image: product.imageUrl,
    // single mini posters have a ready share card (scripts/build-share-images.mjs)
    card: isMiniPoster(product) && !isPosterPack(product) ? shareImageUrl(product, "poster") : null,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const driver = getDriver();
  const product = await productBySlug(slug);
  if (!product || !product.isActive) notFound();

  // Independent reads run together (a refresh used to wait on each in turn).
  const [categories, reviews, settings] = await Promise.all([
    allCategories(),
    // Approved reviews feed Google's star ratings; never block the page on them.
    driver
      .listReviews("approved")
      .then((all) => all.filter((r) => r.productId === product.id))
      .catch(() => []),
    driver.getSettings(),
  ]);
  const category = categories.find((c) => c.id === product.categoryId) ?? null;
  const siblings = await driver.listProducts(
    category ? { activeOnly: true, categorySlug: category.slug } : { activeOnly: true }
  );
  const related = category ? siblings.filter((p) => p.id !== product.id).slice(0, 10) : [];
  // the swipe view's first posters, in the page itself: the most alike ones, so
  // a slow network can swipe before the whole catalogue has loaded
  const nextUp = relatedOrder(product, siblings.filter((p) => p.id !== product.id), 1).slice(0, 12);

  // Previous / next sticker in the same order as the category page (wraps).
  const at = siblings.findIndex((p) => p.id === product.id);
  const pick = (i: number) => {
    const p = siblings[(i + siblings.length) % siblings.length];
    return { id: p.id, slug: p.slug, name: p.name, imageUrl: p.displayUrl ?? p.imageUrl };
  };
  const steps =
    at >= 0 && siblings.length > 1
      ? { prev: pick(at - 1), next: pick(at + 1), index: at, total: siblings.length }
      : null;

  // Poster packs show what's inside (wall order).
  const packPosters = product.packItems.length
    ? await driver.getProductsByIds(product.packItems).then((found) =>
        product.packItems.flatMap((id, i) => {
          const p = found.find((f) => f.id === id);
          return p ? [{ id: p.id, slug: p.slug, name: p.name, imageUrl: p.thumbUrl ?? p.imageUrl, active: p.isActive, inches: product.packSizes[i] ?? 6 }] : [];
        })
      )
    : [];
  // A wall is drawn from these, so the browser starts on them before any JS runs.
  if (isWallSetup(product) && packPosters.length) {
    preconnect(new URL(packPosters[0].imageUrl).origin);
    for (const poster of packPosters) preload(poster.imageUrl, { as: "image", fetchPriority: "high" });
  }
  const { rates } = settings;
  const structuredData = productStructuredData(product, category, reviews, rates);
  const categoryNames = product.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter((n): n is string => !!n);
  const details = productDetails(product, categoryNames);

  return (
    <>
    {/* Phones: swipe view first in the HTML, so it's the first thing drawn while
        the page is still downloading (no flash of the page view underneath);
        a saved "page view" choice is applied in <head> (lib/view-script.ts).
        Outside the isolated wrapper below so it can cover the header. */}
    <StickerReel
      initial={product}
      category={category ? { id: category.id, name: category.name, slug: category.slug } : null}
      packPosters={packPosters}
      // sent even with the live catalogue on (productSnapshot sends none): 12 small entries
      nextUp={nextUp.map((p) => ({ ...p, description: "" }))}
    />
    <div className="relative isolate overflow-x-clip">
    <div className="no-select mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-36 sm:px-8 lg:pb-20">
      <JsonLd data={structuredData} />
      <MetaViewContent
        id={product.id}
        name={product.name}
        price={product.sizes.length ? Math.min(...product.sizes.map((s) => s.price)) : product.price}
        category={category?.name}
      />
      <ProductDetailClient
        initial={product}
        category={category ? { name: category.name, slug: category.slug } : null}
        related={productSnapshot(related)}
        steps={steps}
        packPosters={packPosters}
      />
      {isMiniPoster(product) && !isPosterPack(product) ? (
        <ProductAboutChoice poster={details} sticker={productDetails(product, categoryNames, "sticker")} />
      ) : (
        <ProductAbout {...details} />
      )}
    </div>
    </div>
    </>
  );
}
