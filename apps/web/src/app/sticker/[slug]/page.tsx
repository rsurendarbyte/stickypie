import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import ProductDetailClient from "@/components/product-detail-client";
import { ProductAbout } from "@/components/seo-blocks";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import {
  productDetails,
  productSeoDescription,
  productSeoTitle,
  productStructuredData,
} from "@/lib/seo";
import { pageMetadata } from "@/lib/site";

// Every active product page is prerendered at build time (free static asset
// on Cloudflare) and then refreshes its stock/price live from Supabase in the
// browser. Products added after the last deploy still render on demand.
// Stored in the R2 page cache once built (at deploy, or on the first visit
// for a sticker added later) and refreshed in the background at most every
// 10 minutes, so admin edits show up without a deploy.
export const revalidate = 600;

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
  const product = await getDriver().getProductBySlug(slug);
  if (!product || !product.isActive) return { title: "Sticker" };
  return pageMetadata({
    title: productSeoTitle(product),
    description: productSeoDescription(product),
    path: `/sticker/${product.slug}`,
    image: product.imageUrl,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const driver = getDriver();
  const product = await driver.getProductBySlug(slug);
  if (!product || !product.isActive) notFound();

  const categories = await driver.listCategories();
  const category = categories.find((c) => c.id === product.categoryId) ?? null;
  const siblings = await driver.listProducts(
    category ? { activeOnly: true, categorySlug: category.slug } : { activeOnly: true }
  );
  const related = category ? siblings.filter((p) => p.id !== product.id).slice(0, 10) : [];

  // Previous / next sticker in the same order as the category page (wraps).
  const at = siblings.findIndex((p) => p.id === product.id);
  const pick = (i: number) => {
    const p = siblings[(i + siblings.length) % siblings.length];
    return { slug: p.slug, name: p.name, imageUrl: p.imageUrl };
  };
  const steps =
    at >= 0 && siblings.length > 1
      ? { prev: pick(at - 1), next: pick(at + 1), index: at, total: siblings.length }
      : null;

  // Approved reviews feed Google's star ratings; never block the page on them.
  const reviews = await driver
    .listReviews("approved")
    .then((all) => all.filter((r) => r.productId === product.id))
    .catch(() => []);
  const structuredData = productStructuredData(product, category, reviews);
  const details = productDetails(
    product,
    product.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter((n): n is string => !!n)
  );

  return (
    <div className="relative isolate overflow-x-clip">
    <div className="no-select mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-36 sm:px-8 lg:pb-20">
      <JsonLd data={structuredData} />
      <ProductDetailClient
        initial={product}
        category={category ? { name: category.name, slug: category.slug } : null}
        related={productSnapshot(related)}
        steps={steps}
      />
      <ProductAbout {...details} />
    </div>
    </div>
  );
}
