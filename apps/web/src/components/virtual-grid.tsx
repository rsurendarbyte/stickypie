"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Before the browser has measured anything (and for search engines): this many cards. */
const FIRST_PAINT = 24;
/** Rows kept rendered above and below the screen. */
const OVERSCAN_ROWS = 4;

/**
 * A responsive CSS grid that only renders the rows near the screen (window
 * scroll). Rows above and below are replaced by padding of the same height, so
 * the scrollbar, scroll restoration and "jump to" all behave as if every card
 * were there. Column count comes from the grid's own CSS, so breakpoints stay
 * in the className.
 */
export default function VirtualGrid<T>({
  items,
  getKey,
  render,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T, index: number) => React.ReactNode;
  className: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(0);
  const [rowH, setRowH] = useState(0);
  const [range, setRange] = useState<[number, number] | null>(null);

  // Columns and row height, from the live grid.
  const measure = useCallback(() => {
    const el = grid.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const n = style.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    const gap = parseFloat(style.rowGap) || 0;
    const first = el.firstElementChild as HTMLElement | null;
    setCols(n);
    if (first) {
      const h = first.offsetHeight + gap;
      setRowH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    }
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = grid.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Which rows are near the screen.
  useEffect(() => {
    if (!cols || !rowH) return;
    // Runs straight in the scroll event (it's only a few numbers), so a fast
    // fling never shows an empty gap waiting for the next frame.
    const update = () => {
      const el = grid.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top; // relative to the screen
      const rows = Math.ceil(items.length / cols);
      const first = Math.max(0, Math.floor(-top / rowH) - OVERSCAN_ROWS);
      const last = Math.min(rows, Math.ceil((window.innerHeight - top) / rowH) + OVERSCAN_ROWS);
      setRange((prev) => (prev && prev[0] === first && prev[1] === last ? prev : [first, Math.max(first, last)]));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [cols, rowH, items.length]);

  // Not measured yet: a plain first page of cards.
  if (!cols || !rowH || !range) {
    return (
      <div ref={grid} className={className}>
        {items.slice(0, FIRST_PAINT).map((item, i) => (
          <div key={getKey(item)}>{render(item, i)}</div>
        ))}
      </div>
    );
  }

  const rows = Math.ceil(items.length / cols);
  const [firstRow, lastRow] = range;
  const start = firstRow * cols;
  const end = Math.min(items.length, lastRow * cols);
  return (
    <div
      ref={grid}
      className={className}
      style={{
        paddingTop: firstRow * rowH,
        paddingBottom: Math.max(0, rows - lastRow) * rowH,
      }}
    >
      {items.slice(start, end).map((item, i) => (
        <div key={getKey(item)}>{render(item, start + i)}</div>
      ))}
    </div>
  );
}
