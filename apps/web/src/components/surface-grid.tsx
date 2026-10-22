"use client";

import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import { stickersForSurface, surfaceBySlug } from "@/lib/surfaces";

const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";

/** Live, on-sale stickers for one surface page: best fits first, then the rest. */
export default function SurfaceGrid({ slug, initial }: { slug: string; initial: Catalog }) {
  const { categories, products, loaded } = useLiveCatalog(initial);
  useWindowScrollMemory(loaded);
  const surface = surfaceBySlug(slug);
  if (!surface) return null;

  if (!loaded && products.length === 0) {
    return (
      <div className={`mt-8 ${GRID}`}>
        {Array.from({ length: 12 }, (_, i) => (
          <ProductCardSkeleton key={i} index={i} width="w-full" />
        ))}
      </div>
    );
  }

  const { matched, others } = stickersForSurface(surface, products, categories);
  return (
    <>
      {matched.length > 0 && (
        <div className={`mt-8 ${GRID}`}>
          {matched.map((p) => (
            <ProductCard key={p.id} product={p} width="w-full" />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-xl font-bold">
            {matched.length > 0 ? `More stickers for your ${surface.noun}` : `Stickers for your ${surface.noun}`}
          </h2>
          <div className={`mt-5 ${GRID}`}>
            {others.map((p) => (
              <ProductCard key={p.id} product={p} width="w-full" />
            ))}
          </div>
        </>
      )}
    </>
  );
}
