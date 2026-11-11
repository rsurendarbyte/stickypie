import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/app/sticker/[slug]/page";
import { FinishStart } from "@/lib/poster-finish";
import { isSinglePoster } from "@/lib/poster";
import { pageMetadata } from "@/lib/site";
import { activeProducts, productBySlug } from "@/lib/page-data";

// A poster as a puzzle poster: the poster page, drawn on Puzzle from its first
// HTML (puzzle poster cards link here), so it never shows Wall poster first and
// then flips. Google keeps the poster page itself (the canonical).
export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await activeProducts();
  return products.filter(isSinglePoster).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product || !product.isActive) return { title: "Puzzle poster" };
  const name = product.name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "");
  return pageMetadata({
    title: `${name} — Puzzle Poster`,
    description: `${name} as a puzzle poster: 9 cards that join into one big 12 × 18 in or 18 × 27 in wall poster. Ships across India.`,
    path: `/sticker/${product.slug}`,
    image: product.imageUrl,
  });
}

export default async function PuzzlePosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product || !product.isActive || !isSinglePoster(product)) notFound();
  return (
    <FinishStart finish="puzzle">
      <ProductPage params={params} />
    </FinishStart>
  );
}
