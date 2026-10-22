"use client";

import { useEffect, useId, useRef, useState } from "react";

const PEEL_OFF_MS = 360;

/**
 * One FAQ question: tap to open — the answer smooths down as a little sticker
 * label; tap again and it peels off. The answer stays in the page HTML even
 * while closed, so search engines still read it.
 */
export default function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // No animation on first paint, only after the shopper taps.
  const [touched, setTouched] = useState(false);
  const timer = useRef<number | null>(null);
  const id = useId();
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function toggle() {
    setTouched(true);
    if (timer.current) window.clearTimeout(timer.current);
    if (!open || closing) {
      setClosing(false);
      setOpen(true);
      return;
    }
    setClosing(true);
    timer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, PEEL_OFF_MS);
  }

  const expanded = open && !closing;
  return (
    <div className="px-4 py-3.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={id}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left font-semibold text-snow"
      >
        {q}
        <span
          className={`text-fog transition-transform duration-200 ${expanded ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <p
            className={`cart-label relative mt-2.5 rounded-xl border-2 border-white bg-ink px-3.5 py-3 text-sm leading-relaxed text-fog shadow-[0_6px_14px_-10px_rgba(16,24,40,0.35)] ${
              touched && open
                ? closing
                  ? "panel-label--off"
                  : "panel-label--on"
                : ""
            }`}
          >
            <span aria-hidden className="cart-label-flap" />
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}
