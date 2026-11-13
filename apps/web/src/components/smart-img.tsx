"use client";

import { useEffect, useRef, useState } from "react";
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
  canvas = false,
}: {
  full: string;
  thumb: string | null | undefined;
  alt: string;
  className?: string;
  /** Above-the-fold image: fetch it first. */
  priority?: boolean;
  /** Receives the <img> element (e.g. to measure where the art is drawn). */
  imgRef?: (el: HTMLImageElement | null) => void;
  /** Draw it on a canvas instead of an <img> (see CanvasArt). */
  canvas?: boolean;
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

  const src = loaded === full ? full : small;
  if (canvas) return <CanvasArt src={src} alt={alt} className={className} priority={priority} />;
  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}

/**
 * The same picture drawn on a canvas. Chrome's LCP ("largest picture drawn") skips
 * canvases, so art that turns up later, like the hero's rotating product slides,
 * can't push the page's LCP out to 20 or 40 seconds when nobody touches the page.
 * Same size and sizing rules as an <img> (the canvas takes the picture's own size);
 * nothing shows until the picture is ready, like an <img> still loading.
 */
function CanvasArt({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    if (priority) img.fetchPriority = "high";
    img.src = src;
    img
      .decode()
      .catch(() => undefined)
      .then(() => {
        const c = ref.current;
        if (cancelled || !c || !img.naturalWidth) return;
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")?.drawImage(img, 0, 0);
      });
    return () => {
      cancelled = true;
    };
  }, [src, priority]);
  // width/height 0 until drawn: an empty canvas would otherwise hold a 300 × 150 box
  return <canvas ref={ref} width={0} height={0} role="img" aria-label={alt} className={className} />;
}
