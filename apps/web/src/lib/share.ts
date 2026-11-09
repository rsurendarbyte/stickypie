"use client";

import { PUZZLE_PERCENT } from "@stickypie/shared";

// Sharing a poster or its puzzle: the phone's own share sheet where there is one
// (WhatsApp, Instagram, Messages…), else the shop's share sheet
// (components/share-sheet.tsx) with WhatsApp, Facebook, X, Telegram and Copy link.
import { useSyncExternalStore } from "react";

export type ShareItem = {
  /** Shown in the sheet and given to the phone's share sheet. */
  title: string;
  /** The message that goes with the link. */
  text: string;
  /** Full link, e.g. https://stickypie.in/puzzle/<slug>. */
  url: string;
  /** Small picture for the sheet's preview row. */
  image?: string | null;
};

let current: ShareItem | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function closeShare() {
  current = null;
  emit();
}

export function useShare(): ShareItem | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
    () => null
  );
}

/** Full link on this site for a path. */
export const shareUrl = (path: string) => `${window.location.origin}${path}`;

/** Shares `item`: the phone's share sheet on touch devices, else the shop's sheet. */
export async function share(item: ShareItem) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: item.title, text: item.text, url: item.url });
      return;
    } catch (err) {
      // closed by the shopper: done; anything else falls back to the shop's sheet
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  current = item;
  emit();
}

type Poster = { slug: string; name: string; thumbUrl?: string | null; imageUrl: string };
const posterName = (name: string) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;

/** Sharing a poster's page. */
export function posterShare(p: Poster, path: string): ShareItem {
  const name = posterName(p.name);
  return { title: name, text: `Check out ${name} on StickyPie 👀`, url: shareUrl(path), image: p.thumbUrl ?? p.imageUrl };
}

/** Sharing a poster's puzzle, with the sharer's time when they've solved it. */
export function puzzleShare(p: { slug: string; name: string; image?: string | null }, solvedIn?: number, percent = PUZZLE_PERCENT): ShareItem {
  const name = posterName(p.name);
  return {
    title: `Can you solve ${name}?`,
    text: solvedIn
      ? `I solved this poster puzzle in ${solvedIn}s 🧩 Can you beat me? Solve it and win ${percent}% off puzzle posters on StickyPie!`
      : `Can you solve this poster puzzle? 🧩 Fix the 9 pieces and win ${percent}% off puzzle posters on StickyPie!`,
    url: shareUrl(`/puzzle/${p.slug}`),
    image: p.image ?? null,
  };
}
