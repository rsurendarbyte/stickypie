"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Plus, X } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { packPosterSizes } from "@stickypie/shared";
import { wallBackground, wallSpots } from "@/lib/poster";
import { posterImage } from "@/lib/poster-images";
import type { WallEffect } from "@/lib/wall-effects";

/**
 * When each wall started going up on this page load. The page can rebuild a wall
 * any number of times while it loads, so the animation runs on this clock and not
 * on the build: a rebuilt copy joins in where the first had got to, or shows the
 * finished wall, and it never plays twice.
 */
const hungAt = new Map<string, number>();
const HANG_MS = 4000;

/**
 * Walls that have gone up on each page, for this browser tab. Shop links are full
 * page loads, so Back builds the page afresh and the clock above starts empty; this
 * list is how a page knows its walls are already up. A refresh plays them again.
 */
const SEEN_KEY = "stickypie.walls";
const seenKey = (id: string) => `${window.location.pathname} ${id}`;
const noop = () => () => {};

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") sessionStorage.removeItem(SEEN_KEY);
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

const seenOnLoad = new Set(readSeen());

function markSeen(id: string) {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, seenKey(id)])].slice(-300)));
  } catch {
    // storage unavailable: the wall just plays again next time
  }
}

/**
 * A wall set being hung: the painted wall with an outline for every poster,
 * then the real posters go up one by one, each at its true place and size, when
 * it comes into view. A page without the poster list (a related row) cuts each
 * poster from the set's picture instead. No saved positions → just the picture.
 * `bare`: no wall, just the formation of posters, as large as the space allows.
 * `effect`: how the posters arrive on a card (see .wall-fx in globals.css).
 * `posters`: the shopper's picks, in place of the set's own posters ("" = an emptied spot).
 * `onRemove` / `onAdd`: a close button on each poster, and an add button on an emptied spot.
 */
export default function WallStage({
  product,
  src,
  alt,
  sizes,
  srcSet,
  bare = false,
  effect,
  posters,
  onRemove,
  onAdd,
  className = "",
}: {
  product: Product;
  src: string;
  alt: string;
  srcSet?: string;
  sizes?: string;
  bare?: boolean;
  effect?: WallEffect;
  posters?: string[] | null;
  onRemove?: (spot: number) => void;
  onAdd?: (spot: number) => void;
  className?: string;
}) {
  const spots = wallSpots(product);
  const ids = posters ?? product.packItems;
  const urls = spots.map((_, i) => posterImage(ids[i]));
  const box = useRef<HTMLDivElement>(null);
  // Measured instead of the wall itself, which an effect may have scaled up or turned.
  const frame = useRef<HTMLDivElement>(null);
  // Server and first pass say no, so the page's first paint matches the server's.
  const seen = useSyncExternalStore(noop, () => seenOnLoad.has(seenKey(product.id)), () => false);
  // How long ago this wall started going up; null = not yet.
  const [age, setAge] = useState<number | null>(() => {
    const at = hungAt.get(product.id);
    return at === undefined ? null : performance.now() - at;
  });

  useEffect(() => {
    const el = frame.current ?? box.current;
    if (!el || !spots.length || age !== null || seen) return;
    let live = true;
    const go = () => {
      if (!hungAt.has(product.id)) {
        hungAt.set(product.id, performance.now());
        markSeen(product.id);
      }
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
  }, [src, spots.length, seen]);

  // An older pack's picture is a collage, so posters can't be cut from it.
  const noCut = product.tags.includes("wall collage") && urls.some((url, i) => ids[i] && !url);
  if (noCut) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={`size-full object-contain ${className}`} />;
  }
  if (!spots.length) {
    return <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading="lazy" decoding="async" className={`size-full object-cover ${className}`} />;
  }

  const state = seen ? "is-done" : age === null ? "" : age > HANG_MS ? "is-done" : "is-up";
  const delay = (ms: number) => `${ms - (age ?? 0)}ms`;
  // The formation's own box, so without a wall it fills the space it's given.
  const left = bare ? Math.min(...spots.map((s) => s.x)) : 0;
  const top = bare ? Math.min(...spots.map((s) => s.y)) : 0;
  const width = bare ? Math.max(...spots.map((s) => s.x + s.w)) - left : 100;
  const height = bare ? Math.max(...spots.map((s) => s.y + s.h)) - top : 100;

  // What the effects need: each poster's centre, left-to-right turn, and the biggest one.
  const centres = spots.map((s) => [(s.x + s.w / 2 - left) / width, (s.y + s.h / 2 - top) / height]);
  const turns = spots.map((_, i) => i).sort((a, b) => centres[a][0] - centres[b][0] || centres[a][1] - centres[b][1]);
  const big = spots.reduce((best, s, i) => (s.w * s.h > spots[best].w * spots[best].h ? i : best), 0);
  const away = centres.map((c) => Math.hypot(c[0] - centres[big][0], c[1] - centres[big][1]));
  const stagger = (i: number) => {
    if (effect === "pull") return (away[i] / (Math.max(...away) || 1)) * 420 + 120;
    const order = turns.indexOf(i);
    return order * (effect === "sweep" ? 60 : effect === "doors" ? 80 : effect === "deal" ? 70 : 90);
  };
  const posterSizes = packPosterSizes(product);
  const fxVars = (s: (typeof spots)[number], i: number) =>
    effect === "deal"
      ? ({
          "--cx": `${((0.5 - centres[i][0]) * width * 100) / s.w}%`,
          "--cy": `${((0.5 - centres[i][1]) * height * 100) / s.h}%`,
          "--tilt": `${(i % 2 ? 1 : -1) * (4 + (i % 4) * 3)}deg`,
        } as React.CSSProperties)
      : undefined;

  const wall = (
    <div
      ref={box}
      role="img"
      aria-label={alt}
      style={
        bare
          ? {
              width: `min(100cqw, calc(100cqh * ${width / height}))`,
              aspectRatio: `${width} / ${height}`,
              animationDelay: effect ? delay(0) : undefined,
              transformOrigin: effect === "pull" ? `${centres[big][0] * 100}% ${centres[big][1] * 100}%` : undefined,
            }
          : (wallBackground(product) ?? undefined)
      }
      className={`relative ${bare ? "" : "size-full overflow-hidden"} ${effect ? `wall-fx wall-fx-${effect} wall-tags ${state}` : ""} ${className}`}
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
          <span className={`wall-slot absolute inset-0 ${bare ? "wall-slot--bare" : ""} ${i === big ? "wall-slot--first" : ""} ${ids[i] ? "" : "wall-slot--empty"} ${state}`} style={{ animationDelay: delay(stagger(i) + 260) }} />
          {!ids[i] && onAdd && (
            <button
              type="button"
              aria-label={`Add a poster to spot ${i + 1}`}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(i);
              }}
              className="absolute inset-0 grid place-items-center"
            >
              <span className="grid size-8 place-items-center rounded-full bg-snow text-white shadow-md">
                <Plus className="size-4" strokeWidth={3} />
              </span>
            </button>
          )}
          {ids[i] && (
          <span
            className={`wall-print absolute inset-0 overflow-hidden ${effect === "pull" && i === big ? "wall-print--first" : ""} ${state}`}
            data-size={effect ? (posterSizes[i] === 9 ? "6×9" : "4×6") : undefined}
            style={
              urls[i]
                ? { ...fxVars(s, i), animationDelay: delay(stagger(i)) }
                : {
                    ...fxVars(s, i),
                    backgroundImage: `url("${src}")`,
                    backgroundSize: `${10000 / s.w}% ${10000 / s.h}%`,
                    backgroundPosition: `${(s.x / (100 - s.w)) * 100}% ${(s.y / (100 - s.h)) * 100}%`,
                    animationDelay: delay(stagger(i)),
                  }
            }
          >
            {urls[i] && <img src={urls[i]!} alt="" draggable={false} className="size-full object-cover" />}
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove poster ${i + 1}`}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className="absolute top-0.5 right-0.5 z-[2] grid size-6 place-items-center"
              >
                <span className="grid size-[18px] place-items-center rounded-full bg-[rgba(16,24,40,0.74)] text-white">
                  <X className="size-3" strokeWidth={3} />
                </span>
              </button>
            )}
          </span>
          )}
        </span>
      ))}
    </div>
  );
  return bare ? (
    <div ref={frame} className="grid size-full place-items-center" style={{ containerType: "size" }}>
      {wall}
    </div>
  ) : (
    wall
  );
}
