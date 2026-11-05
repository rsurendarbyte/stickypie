"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type FeedItem = {
  key: string;
  /** Its height until measured, gap included. */
  height: number;
  render: () => React.ReactNode;
};

/** Kept rendered above and below the screen. */
const OVERSCAN = 700;

/**
 * One column of blocks of different heights that only renders those near the
 * screen (window scroll), with one scroll listener however long the list is.
 * What's above and below is padding of the same height, so the scrollbar and
 * Back behave as if every block were there.
 */
export default function VirtualFeed({ items }: { items: FeedItem[] }) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 3]);

  // Where each block starts; one more entry at the end: the total height.
  const offsets = useMemo(() => {
    const out = [0];
    for (const item of items) out.push(out[out.length - 1] + (measured.current.get(item.key) ?? item.height));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, version]);

  useLayoutEffect(() => {
    // Runs straight in the scroll event (it's only a few numbers), so a fast
    // fling never shows an empty gap waiting for the next frame.
    const update = () => {
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const from = -top - OVERSCAN;
      const to = window.innerHeight - top + OVERSCAN;
      // Past the end (a shorter list just came in): only the last block.
      const next = offsets.findIndex((y) => y > from);
      const first = Math.max(0, (next < 0 ? items.length : next) - 1);
      const end = offsets.findIndex((y) => y >= to);
      const last = end < 0 ? items.length : Math.min(items.length, end);
      setRange((prev) => (prev[0] === first && prev[1] === last ? prev : [first, last]));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [offsets, items.length]);

  // Real heights of what's drawn. A block above the screen changing size moves
  // the page by the same amount, so what's on screen stays put (iOS has no
  // scroll anchoring).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver((entries) => {
      let changed = false;
      let shift = 0;
      for (const entry of entries) {
        const block = entry.target as HTMLElement;
        const key = block.dataset.feedKey!;
        const height = block.offsetHeight;
        const before = measured.current.get(key) ?? items.find((item) => item.key === key)?.height ?? height;
        if (Math.abs(before - height) <= 1) continue;
        measured.current.set(key, height);
        changed = true;
        if (block.getBoundingClientRect().bottom < 0) shift += height - before;
      }
      if (shift) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });
      if (changed) setVersion((n) => n + 1);
    });
    for (const block of el.children) watch.observe(block);
    return () => watch.disconnect();
  }, [items, range]);

  const first = Math.min(range[0], items.length);
  const last = Math.min(range[1], items.length);
  return (
    <div
      ref={box}
      style={{
        paddingTop: offsets[first],
        paddingBottom: offsets[items.length] - offsets[Math.max(first, last)],
        overflowAnchor: "none",
      }}
    >
      {items.slice(first, last).map((item) => (
        <div key={item.key} data-feed-key={item.key}>
          {item.render()}
        </div>
      ))}
    </div>
  );
}
