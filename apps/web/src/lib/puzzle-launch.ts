"use client";

// The poster puzzle game has its own address, /puzzle/<slug>. Inside the shop a
// Play & win opens the site's one game (components/puzzle-launcher.tsx) full
// screen right over the page, and puts that address in the bar (one history
// step): no page load to open it, and closing (or Back) just steps back to the
// page underneath, still where it was. Opened from outside (an ad, a shared
// link), /puzzle/<slug> is a real page (app/puzzle/[slug]) whose HTML already
// shows the game screen (components/puzzle-boot.tsx).
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
  /** Drawn full screen as a page (no pop-up look): the /puzzle/ page, or opened in place with its address. */
  page?: boolean;
  /** Opened over a shop page with /puzzle/<slug> pushed into history: closing steps back. */
  inPlace?: boolean;
  /** The /puzzle/ page itself, which showed the poster ("Remember it!") while loading. */
  waited?: boolean;
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

function set(next: PuzzleLaunch | null) {
  current = next;
  listeners.forEach((fn) => fn());
}

// The browser's own history methods: Next.js wraps pushState and would re-render
// the page. Its state is kept (spread), so Next treats the step as its own.
const STEP = "puzzleGame";
if (typeof window !== "undefined") {
  // Back (or closing) leaves the game's history step: the game goes, the page stays
  window.addEventListener("popstate", () => {
    if (current?.inPlace && window.history.state?.[STEP] !== current.slug) set(null);
  });
}

/** Play & win: the game full screen over this page, at its own address. */
export function launchPuzzle(poster: PuzzleLaunch) {
  if (current?.inPlace) return;
  History.prototype.pushState.call(window.history, { ...window.history.state, [STEP]: poster.slug }, "", puzzleHref(poster.slug, poster.size));
  set({ ...poster, page: true, inPlace: true });
}

/** The /puzzle/ page: opens the game as the page. */
export function openPuzzlePage(poster: PuzzleLaunch) {
  set({ ...poster, page: true, waited: true });
}

/** Closing the game: back to the page underneath (instant), or for the /puzzle/ page where the shopper came from. */
export function closePuzzle() {
  const poster = current;
  if (!poster) return;
  if (poster.inPlace) {
    // the popstate listener above closes it once the step is gone
    if (window.history.state?.[STEP] === poster.slug) window.history.back();
    else set(null);
    return;
  }
  let fromShop = false;
  try {
    fromShop = !!document.referrer && new URL(document.referrer).host === location.host && history.length > 1;
  } catch {}
  if (fromShop) history.back();
  else {
    // came straight into the game (an ad, a shared link): the game page leaves
    // history, and Back from the poster page goes home, not into the game again
    try {
      sessionStorage.setItem(GAME_EXIT, poster.slug);
    } catch {}
    location.replace(puzzlePosterHref(poster.slug));
  }
}

const GAME_EXIT = "stickypie.game-exit";

/** Back on a poster page reached by closing a game opened from outside the shop: true means go home. */
export function backGoesHome(slug: string): boolean {
  try {
    if (sessionStorage.getItem(GAME_EXIT) !== slug) return false;
    sessionStorage.removeItem(GAME_EXIT);
    return true;
  } catch {
    return false;
  }
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
