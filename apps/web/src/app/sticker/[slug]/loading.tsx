"use client";

// Shown the instant a sticker is tapped, while its page comes from the server.
// The browser usually already has that sticker (the list the shopper tapped it
// in loaded the whole catalogue), so we draw the real sticker page from that
// data straight away instead of a loader — the server's page then takes over
// without a visible change. Without that data (a direct visit), the loader.
// Phones get the swipe view here too, exactly as the server page draws it, so
// a tap goes straight to the swipe view (no flash of the page view first).
import { useParams } from "next/navigation";
import { inCategory } from "@stickypie/shared";
import ProductDetailClient from "@/components/product-detail-client";
import StickerReel from "@/components/sticker-reel";
import { PageLoader } from "@/components/sticker-loader";
import { useLiveCatalog } from "@/lib/live-catalog";

const EMPTY = { categories: [], products: [] };

export default function Loading() {
  const { slug } = useParams<{ slug: string }>();
  const { products, categories } = useLiveCatalog(EMPTY);
  const product = products.find((p) => p.slug === slug);
  if (!product) return <PageLoader />;

  const category = categories.find((c) => c.id === product.categoryId) ?? null;
  // Same previous / next order as the server page: the category, newest first.
  const siblings = category ? products.filter((p) => inCategory(p, category.id)) : products;
  const at = siblings.findIndex((p) => p.id === product.id);
  const pick = (i: number) => {
    const p = siblings[(i + siblings.length) % siblings.length];
    return { slug: p.slug, name: p.name, imageUrl: p.imageUrl };
  };
  const steps =
    at >= 0 && siblings.length > 1
      ? { prev: pick(at - 1), next: pick(at + 1), index: at, total: siblings.length }
      : null;

  return (
    <>
    <StickerReel
      initial={product}
      category={category ? { id: category.id, name: category.name, slug: category.slug } : null}
    />
    <div className="relative isolate overflow-x-clip">
      <div className="no-select mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-36 sm:px-8 lg:pb-20">
        <ProductDetailClient
          initial={product}
          category={category ? { name: category.name, slug: category.slug } : null}
          related={siblings.filter((p) => p.id !== product.id).slice(0, 10)}
          steps={steps}
        />
      </div>
    </div>
    </>
  );
}
