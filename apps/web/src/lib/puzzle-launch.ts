"use client";

// Opens the poster puzzle game right where the shopper is (a card, the hero
// fan), with no page load: the picture is the one already on screen, so the
// board shows at once even on a slow network. One game for the whole site,
// drawn by components/puzzle-launcher.tsx.
import { useSyncExternalStore } from "react";

/** What the game needs to start: the poster, and a picture already in the browser. */
export type PuzzleLaunch = {
  id: string;
  slug: string;
  name: string;
  /** Shown first (already loaded on the card). */
  src: string;
  /** Sharper picture, swapped in once it has loaded. */
  sharp?: string | null;
  aspectRatio?: number | null;
  /** Card size picked on the page (Add to cart after a win uses it). */
  size?: number | null;
};

type PosterLike = { id: string; slug: string; name: string; imageUrl: string; thumbUrl?: string | null; displayUrl?: string | null; aspectRatio?: number | null };

/** A poster as a launch: `shown` is the picture already on screen (else the card picture). */
export function launchOf(p: PosterLike, shown?: string | null): PuzzleLaunch {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    src: shown ?? p.thumbUrl ?? p.imageUrl,
    sharp: p.displayUrl ?? p.imageUrl,
    aspectRatio: p.aspectRatio ?? null,
  };
}

let current: PuzzleLaunch | null = null;
const listeners = new Set<() => void>();

export function launchPuzzle(poster: PuzzleLaunch) {
  current = poster;
  listeners.forEach((fn) => fn());
}

export function closePuzzle() {
  current = null;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function usePuzzleLaunch(): PuzzleLaunch | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

// The hero fan's middle poster, for the hero's Wall posters card (its Play & win).
// Kept after the fan slide moves on, so the button stays put.
let heroPoster: PuzzleLaunch | null = null;
const heroListeners = new Set<() => void>();

export function setHeroPuzzle(poster: PuzzleLaunch) {
  if (heroPoster?.id === poster.id) return;
  heroPoster = poster;
  heroListeners.forEach((fn) => fn());
}

export function useHeroPuzzle(): PuzzleLaunch | null {
  return useSyncExternalStore(
    (fn) => {
      heroListeners.add(fn);
      return () => {
        heroListeners.delete(fn);
      };
    },
    () => heroPoster,
    () => null
  );
}

/** A plain click on a Play link: open the game here instead of following it. */
export function playHere(e: React.MouseEvent, poster: PuzzleLaunch) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  launchPuzzle(poster);
}
