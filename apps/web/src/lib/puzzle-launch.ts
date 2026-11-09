"use client";

// The poster puzzle game has its own page, /puzzle/<slug> (app/puzzle/[slug]):
// every Play & win goes there. That page opens the site's one game (drawn by
// components/puzzle-launcher.tsx) as the page itself, and its HTML already
// shows the game screen (components/puzzle-boot.tsx), so it draws at once.
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
  /** Drawn as the /puzzle/ page itself: closing leaves the page. */
  page?: boolean;
};

/** A poster's page as a puzzle poster (drawn on Puzzle from the start). */
export function puzzlePosterHref(slug: string): string {
  return `/sticker/${slug}/puzzle`;
}

/** The game's own page for a poster (and the card size picked, if any). */
export function puzzleHref(slug: string, size?: number | null): string {
  return `/puzzle/${slug}${size ? `?size=${size}` : ""}`;
}

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

/** Play & win: off to the game's own page. */
export function launchPuzzle(poster: PuzzleLaunch) {
  window.location.href = puzzleHref(poster.slug, poster.size);
}

/** The /puzzle/ page: opens the game as the page. */
export function openPuzzlePage(poster: PuzzleLaunch) {
  current = { ...poster, page: true };
  listeners.forEach((fn) => fn());
}

/** Closing the game page: back where the shopper came from in the shop, else the poster's page. */
export function closePuzzle() {
  const poster = current;
  if (!poster) return;
  let fromShop = false;
  try {
    fromShop = !!document.referrer && new URL(document.referrer).host === location.host && history.length > 1;
  } catch {}
  if (fromShop) history.back();
  else location.href = puzzlePosterHref(poster.slug);
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

/** A plain click on a Play link: off to the game page (with the size picked). */
export function playHere(e: React.MouseEvent, poster: PuzzleLaunch) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  launchPuzzle(poster);
}
