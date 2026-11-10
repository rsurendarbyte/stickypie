"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PUZZLE_POSTER_PRICES, priceForSize, productSizes, withFinish } from "@stickypie/shared";
import { closePuzzle, usePuzzleLaunch, type PuzzleLaunch } from "@/lib/puzzle-launch";
import { posterTitle } from "./product-card";
import { usePosterCatalog } from "./wall-size-map";
import { useCart } from "./cart-context";
import { toCartProduct } from "./size-picker";

// The game's code (about 28 KB) loads only when a game opens, or quietly once
// the page has settled, so first loads don't carry it.
const loadGame = () => import("./puzzle-game");
const PuzzleGame = dynamic(loadGame, { ssr: false });

/**
 * The site's one poster puzzle game, opened from any Play & win (lib/puzzle-launch).
 * Starts on the picture already on screen and swaps in the sharp one when it
 * arrives; after a win, Add to cart adds the poster as a puzzle poster (9 × 4×6).
 */
export default function PuzzleLauncher() {
  const launch = usePuzzleLaunch();
  // kept while the sheet peels away after closing
  const [last, setLast] = useState<PuzzleLaunch | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const posters = usePosterCatalog();
  const { add, openCart } = useCart();

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const t = window.setTimeout(() => (w.requestIdleCallback ?? ((cb: () => void) => cb()))(() => void loadGame().catch(() => {})), 4000); // an early fetch may fail quietly; opening the game retries
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!launch) return;
    setLast(launch);
    setSrc(launch.src);
    if (!launch.sharp || launch.sharp === launch.src) return;
    let live = true;
    const sharp = new Image();
    sharp.onload = () => live && setSrc(launch.sharp!);
    sharp.src = launch.sharp;
    return () => {
      live = false;
    };
  }, [launch]);

  if (!last || !src) return null;
  const product = posters.find((p) => p.id === last.id);
  const puzzle = product ? withFinish(product, "puzzle") : null;
  const sizes = puzzle ? productSizes(puzzle) : [];
  const size = sizes.find((s) => s.inches === last.size)?.inches ?? sizes[0]?.inches ?? null;
  const price = puzzle ? (priceForSize(puzzle, size)?.price ?? undefined) : PUZZLE_POSTER_PRICES[6];
  return (
    <PuzzleGame
      open={launch !== null}
      page={last.page}
      waited={last.waited}
      onClose={closePuzzle}
      slug={last.slug}
      src={src}
      name={posterTitle(last.name)}
      aspectRatio={last.aspectRatio ?? product?.aspectRatio ?? null}
      price={price}
      onAddToCart={
        product && price !== undefined
          ? () => {
              add(toCartProduct(product, size, price, "puzzle"));
              openCart();
            }
          : undefined
      }
    />
  );
}
