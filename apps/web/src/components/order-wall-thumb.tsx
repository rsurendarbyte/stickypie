"use client";

import { useMemo } from "react";
import { useLiveCatalog } from "@/lib/live-catalog";

const NO_CATALOG = { categories: [], products: [] };

/** An ordered wall's small picture: its posters in their places (see orderWallPosters). */
export default function OrderWallThumb({
  posters,
  className = "",
}: {
  posters: { src: string; x: number; y: number; w: number; h: number }[];
  className?: string;
}) {
  // An order keeps each poster's print file; the catalogue has the same poster small.
  const { products, loaded } = useLiveCatalog(NO_CATALOG);
  const thumbs = useMemo(() => new Map(products.map((p) => [p.imageUrl, p.tinyUrl ?? p.thumbUrl])), [products]);
  return (
    <span className={`relative block shrink-0 ${className}`}>
      {loaded &&
        posters.map((poster, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={thumbs.get(poster.src) ?? poster.src}
            alt=""
            loading="lazy"
            className="absolute rounded-[1px] object-cover"
            style={{ left: `${poster.x}%`, top: `${poster.y}%`, width: `${poster.w}%`, height: `${poster.h}%` }}
          />
        ))}
    </span>
  );
}
