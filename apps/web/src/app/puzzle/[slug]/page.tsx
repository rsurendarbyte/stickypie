import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/app/sticker/[slug]/page";
import { isMiniPoster, isPosterPack } from "@/lib/poster";
import { getDriver } from "@/lib/data";
import { posterSharePath, puzzleSharePath, shareImageUrl } from "@/lib/share-links";
import { pageMetadata } from "@/lib/site";

// A shared poster puzzle: its own link preview ("Can you solve this poster?"),
// then the poster's page with the game already running. Not indexed: search
// lands on the poster page itself (the canonical).
export const revalidate = 600;

export async function generateStaticParams() {
  const products = await getDriver().listProducts({ activeOnly: true });
  return products.filter((p) => isMiniPoster(p) && !isPosterPack(p)).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getDriver().getProductBySlug(slug);
  if (!product || !product.isActive) return { title: "Puzzle" };
  const name = product.name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "");
  return pageMetadata({
    title: `Can you solve this poster? 🧩 ${name}`,
    description: `Put the 9 pieces of ${name} back together in about 30 seconds and win 10% off your StickyPie order.`,
    path: posterSharePath(product.slug),
    shareUrl: puzzleSharePath(product.slug),
    image: product.imageUrl,
    card: shareImageUrl(product, "puzzle"),
    noindex: true,
  });
}

export default async function PuzzlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getDriver().getProductBySlug(slug);
  if (!product || !product.isActive || !isMiniPoster(product) || isPosterPack(product)) notFound();
  return <ProductPage params={params} startPuzzle />;
}
