"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/** After the wall has gone up. */
const START_MS = 900;
const SHOW_MS = 4000;
const LEAVE_MS = 460;

/**
 * Flashes at the top of the wall each time it opens: any poster can be changed. Waits until
 * it's on screen (the swipe view keeps nearby walls ready off screen), lets
 * every tap through, and leaves early at the shopper's first touch.
 */
export default function WallTip() {
  const box = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"waiting" | "showing" | "leaving" | "gone">("waiting");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let start: ReturnType<typeof setTimeout>;
    const seen = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(start);
        if (entry.isIntersecting) start = setTimeout(() => setPhase((p) => (p === "waiting" ? "showing" : p)), START_MS);
      },
      { threshold: 0.6 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      clearTimeout(start);
    };
  }, []);

  useEffect(() => {
    if (phase === "showing") {
      const leave = () => setPhase("leaving");
      const timer = setTimeout(leave, SHOW_MS);
      window.addEventListener("pointerdown", leave);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("pointerdown", leave);
      };
    }
    if (phase === "leaving") {
      const timer = setTimeout(() => setPhase("gone"), LEAVE_MS);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  return (
    <div ref={box} aria-hidden={phase !== "showing"} className="pointer-events-none absolute inset-0 z-30">
      {(phase === "showing" || phase === "leaving") && (
        <div className="absolute inset-x-0 top-1 flex justify-center">
        <div role="status" className={`wall-tip ${phase === "leaving" ? "wall-tip--out" : ""}`}>
          <span className="wall-tip-glass" />
          <span className="wall-tip-dot">
            <X className="size-3.5" strokeWidth={3} />
          </span>
          <span className="wall-tip-text">
            <span className="block font-display text-[15px] leading-tight font-bold">Customize your own wall</span>
            <span className="block text-xs leading-snug opacity-75">Tap the ✕ on a poster to change it</span>
          </span>
        </div>
        </div>
      )}
    </div>
  );
}
