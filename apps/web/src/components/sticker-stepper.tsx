"use client";

import Link from "@/components/page-link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export type StepTarget = { slug: string; name: string; imageUrl: string };
export type Steps = {
  prev: StepTarget;
  next: StepTarget;
  index: number;
  total: number;
};

const href = (t: StepTarget) => `/sticker/${t.slug}`;

/** Opens the sticker's ready-made page (a free static file — no Worker request). */
const open = (t: StepTarget) => window.location.replace(href(t));

/**
 * Previous / next sticker in the same category (wraps around). Uses replace,
 * so Back still returns to wherever the shopper came from instead of walking
 * back through every sticker they flicked past. ←/→ keys work too.
 */
export default function StickerStepper({ steps }: { steps: Steps }) {
  const [pending, setPending] = useState(false);
  const go = (t: StepTarget) => {
    setPending(true);
    open(t);
  };

  // Load both neighbours ahead (page + picture) so the next tap is instant.
  // Weak device / slow network ("lite") gets the page only, not the pictures.
  useEffect(() => {
    const links = [steps.prev, steps.next].map((t) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href(t);
      document.head.appendChild(link);
      if (!document.documentElement.dataset.lite && t.imageUrl)
        new Image().src = t.imageUrl;
      return link;
    });
    return () => links.forEach((l) => l.remove());
  }, [steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      )
        return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest("input, textarea, select, [contenteditable], [role=dialog]")
      )
        return;
      if (e.key === "ArrowLeft") go(steps.prev);
      if (e.key === "ArrowRight") go(steps.next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const btn =
    "peel-btn peel-btn--light grid size-9 shrink-0 place-items-center rounded-full";
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Link
        href={href(steps.prev)}
        onClick={(e) => {
          e.preventDefault();
          go(steps.prev);
        }}
        aria-label={`Previous sticker: ${steps.prev.name}`}
        title={steps.prev.name}
        className={btn}
      >
        <ChevronLeft className="size-4.5" />
      </Link>
      <span className={`${pending ? "inline" : "hidden"} min-w-10 text-center text-xs font-semibold tabular-nums text-fog sm:inline`}>
        {pending ? (
          <Loader2 className="mx-auto size-3.5 animate-spin" />
        ) : (
          `${steps.index + 1} / ${steps.total}`
        )}
      </span>
      <Link
        href={href(steps.next)}
        onClick={(e) => {
          e.preventDefault();
          go(steps.next);
        }}
        aria-label={`Next sticker: ${steps.next.name}`}
        title={steps.next.name}
        className={btn}
      >
        <ChevronRight className="size-4.5" />
      </Link>
    </div>
  );
}

/** Horizontal swipe on the sticker art (phones) → previous / next sticker. */
export function useStepSwipe(steps: Steps | null) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current =
        e.touches.length === 1
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!steps || !from) return;
      const dx = e.changedTouches[0].clientX - from.x;
      const dy = e.changedTouches[0].clientY - from.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const t = dx < 0 ? steps.next : steps.prev;
      open(t);
    },
  };
}
