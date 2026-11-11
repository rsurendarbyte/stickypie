import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PuzzleBoot from "@/components/puzzle-boot";
import PuzzlePageClient from "@/components/puzzle-page-client";
import { isSinglePoster } from "@/lib/poster";
import { getDriver } from "@/lib/data";
import { posterSharePath, puzzleSharePath, shareImageUrl } from "@/lib/share-links";
import { pageMetadata } from "@/lib/site";
import { activeProducts, productBySlug } from "@/lib/page-data";

// A poster's puzzle game, as its own page: every Play & win comes here, and a
// shared link gets its own preview ("Can you solve this poster?"). The HTML
// already draws the game screen (PuzzleBoot); the game takes over when the
// page's code is ready. Not indexed: search lands on the poster page (the canonical).
export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await activeProducts();
  return products.filter(isSinglePoster).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product || !product.isActive) return { title: "Puzzle" };
  const percent = await getDriver().getPuzzlePercent();
  const name = product.name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "");
  return pageMetadata({
    title: `Can you solve this poster? 🧩 ${name}`,
    description: `Put the 9 pieces of ${name} back together in about 30 seconds and win ${percent}% off puzzle posters on StickyPie.`,
    path: posterSharePath(product.slug),
    shareUrl: puzzleSharePath(product.slug),
    image: product.imageUrl,
    card: shareImageUrl(product, "puzzle"),
    noindex: true,
  });
}

export default async function PuzzlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product || !product.isActive || !isSinglePoster(product)) notFound();
  const ratio = product.aspectRatio && product.aspectRatio > 0.3 && product.aspectRatio < 3 ? product.aspectRatio : 2 / 3;
  const poster = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    src: product.thumbUrl ?? product.imageUrl,
    sharp: product.displayUrl ?? product.imageUrl,
    aspectRatio: product.aspectRatio ?? null,
  };
  return (
    <>
      <PuzzleBoot src={poster.src} name={product.name} ratio={ratio} />
      <PuzzlePageClient poster={poster} />
    </>
  );
}
