import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Product } from "@stickypie/shared";
import { formatINR } from "@stickypie/shared";
import ProductDetailClient from "@/components/product-detail-client";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { SITE_NAME, absoluteUrl, jsonLd, pageMetadata } from "@/lib/site";

// Every active product page is prerendered at build time (free static asset
// on Cloudflare) and then refreshes its stock/price live from Supabase in the
// browser. Products added after the last deploy still render on demand.
export async function generateStaticParams() {
  const products = await getDriver().listProducts({ activeOnly: true });
  return products.map((product) => ({ slug: product.slug }));
}

/** "Made in India" → "Made in India Sticker"; leaves "… Decal/Badge/Pack" alone. */
function seoName(product: Product): string {
  return /sticker|decal|badge|pack|label/i.test(product.name)
    ? product.name
    : `${product.name} Sticker`;
}

function seoDescription(product: Product): string {
  const pitch = `Waterproof die-cut vinyl, ${formatINR(product.price)}. Ships across India.`;
  const text = `${product.description.trim()} ${pitch}`;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
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
    title: seoName(product),
    description: seoDescription(product),
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
  const related = category
    ? (await driver.listProducts({ activeOnly: true, categorySlug: category.slug }))
        .filter((p) => p.id !== product.id)
        .slice(0, 10)
    : [];

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: seoName(product),
    description: product.description,
    image: [absoluteUrl(product.imageUrl)],
    sku: product.slug,
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(category ? { category: category.name } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/sticker/${product.slug}`),
      priceCurrency: "INR",
      price: product.price,
      itemCondition: "https://schema.org/NewCondition",
      availability:
        product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-36 sm:px-8 lg:pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productLd) }} />
      <ProductDetailClient
        initial={product}
        category={category ? { name: category.name, slug: category.slug } : null}
        related={productSnapshot(related)}
      />
    </div>
  );
}
