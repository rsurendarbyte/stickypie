"use client";

import { useEffect, useState } from "react";
import { useLite } from "@/lib/lite";

/**
 * Big sticker art without the wait: shows the small WebP card image straight
 * away, then swaps in the full artwork once it has downloaded in the
 * background. In lite mode (weak device / slow network) it stays on the small
 * image and never downloads the big one.
 */
export default function SmartImg({
  full,
  thumb,
  alt,
  className,
  priority = false,
  imgRef,
}: {
  full: string;
  thumb: string | null | undefined;
  alt: string;
  className?: string;
  /** Above-the-fold image: fetch it first. */
  priority?: boolean;
  /** Receives the <img> element (e.g. to measure where the art is drawn). */
  imgRef?: (el: HTMLImageElement | null) => void;
}) {
  const lite = useLite();
  const small = thumb || full;
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (lite || small === full) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.src = full;
    // Swap only once the big file is downloaded AND decoded: swapping on
    // "load" alone made the art flash blank for a frame while a multi-MB PNG
    // was still being decoded (the "blink" on the sticker page).
    img
      .decode()
      .catch(() => undefined) // decode() can reject for odd formats; still swap once loaded
      .then(() => {
        if (!cancelled && img.complete && img.naturalWidth > 0) setLoaded(full);
      });
    return () => {
      cancelled = true;
    };
  }, [full, small, lite]);

  return (
    <img
      ref={imgRef}
      src={loaded === full ? full : small}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}
