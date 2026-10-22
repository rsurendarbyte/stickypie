"use client";

import { useEffect, useState } from "react";
import { formatInches, sizeDimensions } from "@stickypie/shared";

function label(inches: number): string {
  return `${formatInches(inches)} in`;
}

/**
 * Width and height arrows around the sticker art (like a product size
 * drawing), for the size that's picked. Positioned from the image's rendered
 * box, so it hugs the artwork whatever its shape.
 */
export default function SizeRuler({
  img,
  inches,
  aspectRatio,
}: {
  img: HTMLImageElement | null;
  inches: number | null;
  aspectRatio: number | null;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!img) return;
    const measure = () => {
      if (!img.complete || img.naturalWidth === 0) return;
      // object-contain: the drawn art may be smaller than the element.
      const ratio = img.naturalWidth / img.naturalHeight;
      const w = Math.min(img.offsetWidth, img.offsetHeight * ratio);
      const h = w / ratio;
      setBox({
        left: img.offsetLeft + (img.offsetWidth - w) / 2,
        top: img.offsetTop + (img.offsetHeight - h) / 2,
        width: w,
        height: h,
      });
    };
    measure();
    img.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => {
      img.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [img]);

  const dims = inches ? sizeDimensions(inches, aspectRatio) : null;
  if (!box || !dims) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 text-snow/70">
      {/* Width, above the art */}
      <div
        className="absolute flex items-center"
        style={{ left: box.left, top: box.top - 20, width: box.width }}
      >
        <span className="ruler-head ruler-head--left" />
        <span className="h-px flex-1 bg-current" />
        <span className="ruler-head ruler-head--right" />
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-white/80 px-1 text-[11px] font-semibold whitespace-nowrap text-snow">
          {label(dims.width)}
        </span>
      </div>
      {/* Height, left of the art */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: box.left - 20, top: box.top, height: box.height }}
      >
        <span className="ruler-head ruler-head--up" />
        <span className="w-px flex-1 bg-current" />
        <span className="ruler-head ruler-head--down" />
        <span className="absolute top-1/2 -left-4 -translate-x-1/2 -translate-y-1/2 -rotate-90 rounded bg-white/80 px-1 text-[11px] font-semibold whitespace-nowrap text-snow">
          {label(dims.height)}
        </span>
      </div>
    </div>
  );
}
