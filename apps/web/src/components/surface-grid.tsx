"use client";

import ProductCard from "./product-card";
import { asPuzzleEntry, usePuzzleLead } from "@/lib/puzzle-mix";
import ProductCardSkeleton from "./product-card-skeleton";
import VirtualGrid from "./virtual-grid";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";
import { isPosterPack } from "@/lib/poster";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import { useDaySeed } from "@/lib/skin-seed";
import { posterLabel, stickersForSurface, type Surface } from "@/lib/surfaces";
import { wallEffect } from "@/lib/wall-effects";
import type { Product } from "@stickypie/shared";

const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";

const WALL_GRID = "mt-8 grid grid-cols-1 gap-x-3 gap-y-5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-7 @[53rem]:grid-cols-3 @[80rem]:grid-cols-4";
const POSTER_GRID = "mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-7 @[40rem]:grid-cols-3 @[53rem]:grid-cols-4 @[67rem]:grid-cols-5 @[80rem]:grid-cols-6 @[107rem]:grid-cols-8";

/** A poster page: wall sets large, like the Walls page, then single posters. Only what's near the screen is drawn. */
function PosterGrid({ surface, posters }: { surface: Surface; posters: Product[] }) {
  const seed = useDaySeed();
  const walls = posters.filter(isPosterPack);
  // a puzzle poster card first
  const lead = usePuzzleLead();
  const loose = posters.filter((p) => !isPosterPack(p));
  // the puzzle posters page: every poster as its puzzle poster card
  const singles = surface.puzzle ? loose.map((p, i) => asPuzzleEntry(p, i)) : lead(loose);
  return (
    <div className="@container">
      {walls.length > 0 && (
        <VirtualGrid
          items={walls}
          getKey={(p) => p.id}
          render={(p, i, cols) => <ProductCard product={p} width="w-full" wallEffect={wallEffect(Math.floor(i / cols), seed)} />}
          className={WALL_GRID}
        />
      )}
      {singles.length > 0 && (
        <>
          {!surface.puzzle && <h2 className="mt-14 font-display text-xl font-bold">Single {posterLabel(surface)}</h2>}
          <VirtualGrid items={singles} getKey={(p) => p.id} render={(p) => <ProductCard product={p} width="w-full" />} className={POSTER_GRID} />
        </>
      )}
    </div>
  );
}

/** Live, on-sale stickers for one surface page: best fits first, then the rest. */
export default function SurfaceGrid({ surface, initial }: { surface: Surface; initial: Catalog }) {
  const { categories, products, loaded } = useLiveCatalog(initial);
  useWindowScrollMemory(loaded);
  const mix = usePuzzleLead();

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
  if (surface.posters) return <PosterGrid surface={surface} posters={matched} />;
  return (
    <>
      {matched.length > 0 && (
        <div className={`mt-8 ${GRID}`}>
          {mix(matched).map((p) => (
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
            {mix(others).map((p) => (
              <ProductCard key={p.id} product={p} width="w-full" />
            ))}
          </div>
        </>
      )}
    </>
  );
}
