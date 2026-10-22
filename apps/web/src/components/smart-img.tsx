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
}: {
  full: string;
  thumb: string | null | undefined;
  alt: string;
  className?: string;
  /** Above-the-fold image: fetch it first. */
  priority?: boolean;
}) {
  const lite = useLite();
  const small = thumb || full;
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (lite || small === full) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => !cancelled && setLoaded(full);
    img.src = full;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [full, small, lite]);

  return (
    <img
      src={loaded === full ? full : small}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}
