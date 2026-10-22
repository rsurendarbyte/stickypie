"use client";

import { useEffect } from "react";
import { mildSkinFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";

/** Picks this visit's mild page pattern (see .mild-bg in globals.css). */
export default function MildBackground() {
  const seed = useSkinSeed();
  useEffect(() => {
    if (!seed) return;
    const skin = mildSkinFor(seed);
    const root = document.documentElement.style;
    root.setProperty("--mild-color", skin.backgroundColor);
    root.setProperty("--mild-image", skin.backgroundImage);
    root.setProperty("--mild-size", skin.backgroundSize);
  }, [seed]);
  return null;
}
