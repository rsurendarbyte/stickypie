"use client";

import { useEffect } from "react";
import { openPuzzlePage, type PuzzleLaunch } from "@/lib/puzzle-launch";

/** The /puzzle/ page: opens the site's game (components/puzzle-launcher) as the page itself. */
export default function PuzzlePageClient({ poster }: { poster: PuzzleLaunch }) {
  useEffect(() => {
    // ?size=9: the card size picked on the poster page, for Add to cart after a win
    const size = Number(new URLSearchParams(window.location.search).get("size")) || null;
    openPuzzlePage({ ...poster, size });
  }, [poster]);
  return null;
}
