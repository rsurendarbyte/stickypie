"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@stickypie/shared";
import { wallBackground, wallSpots } from "@/lib/poster";
import { posterImage } from "@/lib/poster-images";

/**
 * A wall set being hung: the painted wall with an outline for every poster,
 * then the real posters go up one by one, each at its true place and size, when
 * it comes into view. A page without the poster list (a related row) cuts each
 * poster from the set's picture instead. No saved positions → just the picture.
 * `bare`: no wall, just the formation of posters, as large as the space allows.
 */
export default function WallStage({
  product,
  src,
  alt,
  sizes,
  srcSet,
  bare = false,
  className = "",
}: {
  product: Product;
  src: string;
  alt: string;
  srcSet?: string;
  sizes?: string;
  bare?: boolean;
  className?: string;
}) {
  const spots = wallSpots(product);
  const urls = spots.map((_, i) => posterImage(product.packItems[i]));
  const box = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || !spots.length) return;
    let live = true;
    const start = () => {
      const needed = [...new Set(urls.map((url) => url ?? src))];
      let left = needed.length;
      const done = () => {
        if (--left <= 0 && live) setPlay(true);
      };
      for (const url of needed) {
        const picture = new Image();
        picture.onload = picture.onerror = done;
        picture.src = url;
      }
      // a slow picture never holds up the wall
      window.setTimeout(() => live && setPlay(true), 2500);
    };
    // No wall means a banner or detail page: already on screen, so it starts at once.
    if (bare || !("IntersectionObserver" in window)) {
      start();
      return () => {
        live = false;
      };
    }
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        watch.disconnect();
        start();
      },
      { threshold: 0.3 }
    );
    watch.observe(el);
    return () => {
      live = false;
      watch.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, spots.length]);

  // An older pack's picture is a collage, so posters can't be cut from it.
  const noCut = product.tags.includes("wall collage") && urls.some((url) => !url);
  if (noCut) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={`size-full object-contain ${className}`} />;
  }
  if (!spots.length) {
    return <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading="lazy" decoding="async" className={`size-full object-cover ${className}`} />;
  }

  // The formation's own box, so without a wall it fills the space it's given.
  const left = bare ? Math.min(...spots.map((s) => s.x)) : 0;
  const top = bare ? Math.min(...spots.map((s) => s.y)) : 0;
  const width = bare ? Math.max(...spots.map((s) => s.x + s.w)) - left : 100;
  const height = bare ? Math.max(...spots.map((s) => s.y + s.h)) - top : 100;

  const wall = (
    <div
      ref={box}
      role="img"
      aria-label={alt}
      style={bare ? { width: `min(100cqw, calc(100cqh * ${width / height}))`, aspectRatio: `${width} / ${height}` } : (wallBackground(product) ?? undefined)}
      className={`relative ${bare ? "" : "size-full overflow-hidden"} ${className}`}
    >
      {spots.map((s, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${((s.x - left) / width) * 100}%`,
            top: `${((s.y - top) / height) * 100}%`,
            width: `${(s.w / width) * 100}%`,
            height: `${(s.h / height) * 100}%`,
          }}
        >
          <span className={`wall-slot absolute inset-0 ${bare ? "wall-slot--bare" : ""} ${play ? "is-up" : ""}`} style={{ animationDelay: `${i * 90 + 260}ms` }} />
          <span
            className={`wall-print absolute inset-0 overflow-hidden ${play ? "is-up" : ""}`}
            style={
              urls[i]
                ? { animationDelay: `${i * 90}ms` }
                : {
                    backgroundImage: `url("${src}")`,
                    backgroundSize: `${10000 / s.w}% ${10000 / s.h}%`,
                    backgroundPosition: `${(s.x / (100 - s.w)) * 100}% ${(s.y / (100 - s.h)) * 100}%`,
                    animationDelay: `${i * 90}ms`,
                  }
            }
          >
            {/* a touch larger than its spot: square paper, past the art's rounded corners */}
            {urls[i] && <img src={urls[i]!} alt="" draggable={false} className="size-full scale-[1.07] object-cover" />}
          </span>
        </span>
      ))}
    </div>
  );
  return bare ? (
    <div className="grid size-full place-items-center" style={{ containerType: "size" }}>
      {wall}
    </div>
  ) : (
    wall
  );
}
