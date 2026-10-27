"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

const MAX = 4;
const clamp = (z: number) => Math.min(MAX, Math.max(1, z));

/**
 * Lets the shopper look closer at a picture: pinch, double-tap, mouse wheel or
 * the +/− buttons zoom; one finger (or the mouse) moves it while zoomed.
 * `resetKey` puts it back to fit (e.g. on the next picture).
 */
export default function ZoomPane({ children, resetKey }: { children: ReactNode; resetKey?: unknown }) {
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => setZoom({ z: 1, x: 0, y: 0 }), [resetKey]);

  const zoomTo = (z: number) =>
    setZoom((v) => {
      const next = clamp(z);
      // keep the same spot in the middle, back to centre at 1×
      const k = next / v.z;
      return next === 1 ? { z: 1, x: 0, y: 0 } : { z: next, x: v.x * k, y: v.y * k };
    });

  // Wheel / trackpad pinch zooms the picture, not the page: needs a non-passive listener.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((v) => {
        const z = clamp(v.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)));
        const k = z / v.z;
        return z === 1 ? { z: 1, x: 0, y: 0 } : { z, x: v.x * k, y: v.y * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom.z };
    }
  }

  function move(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      zoomTo((p.z * Math.hypot(a.x - b.x, a.y - b.y)) / p.d);
      return;
    }
    if (zoom.z > 1) setZoom((v) => ({ ...v, x: v.x + now.x - prev.x, y: v.y + now.y - prev.y }));
  }

  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // double-tap / double-click: 2.5× or back to fit
    const t = Date.now();
    if (t - lastTap.current < 300 && pointers.current.size === 0) {
      zoomTo(zoom.z > 1 ? 1 : 2.5);
      lastTap.current = 0;
    } else lastTap.current = t;
  }

  return (
    <div className="relative grid size-full place-items-center">
      <div
        ref={box}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={(e) => e.stopPropagation()}
        className={`grid size-full touch-none place-items-center overflow-hidden ${zoom.z > 1 ? "cursor-grab" : "cursor-zoom-in"}`}
      >
        <div
          style={{
            transform: zoom.z === 1 ? undefined : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`,
          }}
          className={pointers.current.size ? "" : "transition-transform duration-150"}
        >
          {children}
        </div>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 p-1 text-neutral-900 shadow-lg"
      >
        <button type="button" aria-label="Zoom out" onClick={() => zoomTo(zoom.z / 1.5)} disabled={zoom.z <= 1} className="grid size-9 place-items-center rounded-full disabled:opacity-30">
          <Minus className="size-4" />
        </button>
        <span className="min-w-11 text-center text-xs font-bold tabular-nums">{Math.round(zoom.z * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomTo(zoom.z * 1.5)} disabled={zoom.z >= MAX} className="grid size-9 place-items-center rounded-full disabled:opacity-30">
          <Plus className="size-4" />
        </button>
        {zoom.z > 1 && (
          <button type="button" aria-label="Fit to screen" onClick={() => zoomTo(1)} className="grid size-9 place-items-center rounded-full">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
