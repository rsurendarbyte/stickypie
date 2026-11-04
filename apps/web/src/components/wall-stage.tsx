"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@stickypie/shared";
import { wallBackground, wallSpots } from "@/lib/poster";
import { posterImage } from "@/lib/poster-images";

/**
 * When each wall started going up on this page load. The page can rebuild a wall
 * any number of times while it loads, so the animation runs on this clock and not
 * on the build: a rebuilt copy joins in where the first had got to, or shows the
 * finished wall, and it never plays twice.
 */
const hungAt = new Map<string, number>();
const HANG_MS = 2000;

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
  // How long ago this wall started going up; null = not yet.
  const [age, setAge] = useState<number | null>(() => {
    const at = hungAt.get(product.id);
    return at === undefined ? null : performance.now() - at;
  });

  useEffect(() => {
    const el = box.current;
    if (!el || !spots.length || age !== null) return;
    let live = true;
    const go = () => {
      if (!hungAt.has(product.id)) hungAt.set(product.id, performance.now());
      setAge(performance.now() - hungAt.get(product.id)!);
    };
    const start = () => {
      const needed = [...new Set(urls.map((url) => url ?? src))];
      let left = needed.length;
      const loaded = () => {
        if (--left <= 0 && live) go();
      };
      for (const url of needed) {
        const picture = new Image();
        picture.onload = picture.onerror = loaded;
        picture.src = url;
      }
      // a slow picture never holds up the wall
      window.setTimeout(() => live && go(), 2500);
    };
    // A banner or detail page is already on screen, so it starts at once. A copy
    // that isn't showing (the swipe view behind the page) waits until it is.
    const rect = el.getBoundingClientRect();
    const showing = rect.width > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
    if ((bare && showing) || !("IntersectionObserver" in window)) {
      const settle = window.setTimeout(start, 120);
      return () => {
        live = false;
        window.clearTimeout(settle);
      };
    }
    let settle = 0;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        watch.disconnect();
        settle = window.setTimeout(start, 120);
      },
      { threshold: 0.3 }
    );
    watch.observe(el);
    return () => {
      live = false;
      window.clearTimeout(settle);
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

  const state = age === null ? "" : age > HANG_MS ? "is-done" : "is-up";
  const delay = (ms: number) => `${ms - (age ?? 0)}ms`;
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
          <span className={`wall-slot absolute inset-0 ${bare ? "wall-slot--bare" : ""} ${state}`} style={{ animationDelay: delay(i * 90 + 260) }} />
          <span
            className={`wall-print absolute inset-0 overflow-hidden ${state}`}
            style={
              urls[i]
                ? { animationDelay: delay(i * 90) }
                : {
                    backgroundImage: `url("${src}")`,
                    backgroundSize: `${10000 / s.w}% ${10000 / s.h}%`,
                    backgroundPosition: `${(s.x / (100 - s.w)) * 100}% ${(s.y / (100 - s.h)) * 100}%`,
                    animationDelay: delay(i * 90),
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
