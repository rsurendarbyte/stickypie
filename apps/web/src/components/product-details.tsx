"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Palette, Ruler, Truck } from "lucide-react";
import { formatInches } from "@stickypie/shared";

const PEEL_OFF_MS = 360;

/**
 * One row of the accordion. Opening grows the row and smooths a small sticker
 * label down into it; closing peels the label off, then folds the row away.
 */
function Panel({
  icon: Icon,
  title,
  open: startOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);
  const id = useId();
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function toggle() {
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
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={id}
        className="flex w-full cursor-pointer items-center gap-2.5 py-3.5 text-left text-sm font-semibold select-none"
      >
        <Icon className="size-4 shrink-0 text-brand" />
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-fog transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={id}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          {open && (
            <div
              className={`cart-label relative mb-3.5 space-y-2 rounded-xl border-2 border-white bg-ink2 px-3.5 py-3 text-[13px] leading-relaxed text-fog shadow-[0_6px_14px_-10px_rgba(16,24,40,0.35)] ${
                closing ? "panel-label--off" : "panel-label--on"
              }`}
            >
              <span aria-hidden className="cart-label-flap" />
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible product details. Dimensions follow the size picked above
 * (size = longest side; the other side follows the design's aspect ratio).
 */
export default function ProductDetails({ size }: { size: number | null }) {
  const inch = size === null ? null : formatInches(size);
  return (
    <div className="mt-4 max-w-lg rounded-2xl border border-line bg-ink px-4">
      {inch && (
        <Panel icon={Ruler} title={`Dimensions · ${inch}″`}>
          <p>
            Fits within a{" "}
            <span className="font-semibold text-snow">
              {inch} × {inch} inch
            </span>{" "}
            area.
          </p>
          <p>Height &amp; width depend on the aspect ratio of the design.</p>
          <p className="flex items-start gap-1.5 pt-1 text-xs">
            <Palette className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold text-snow">Please note:</span>{" "}
              colours may slightly vary depending on your screen brightness.
            </span>
          </p>
        </Panel>
      )}
      {!inch && (
        <Panel icon={Palette} title="Colour note">
          <p>Colours may slightly vary depending on your screen brightness.</p>
        </Panel>
      )}
      <Panel icon={Truck} title="Shipping">
        <p>
          Packed and dispatched in 2–4 business days, in bend-proof packaging.
        </p>
        <p>
          Shipping is charged by delivery distance and shown at checkout once
          you enter your PIN code.
        </p>
      </Panel>
    </div>
  );
}
