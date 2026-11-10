"use client";

// Wall poster or puzzle poster: a mini poster is sold as either (no longer as a
// sticker). The page decides where it starts, from how the shopper got there:
// /sticker/<slug> starts on Wall poster, /sticker/<slug>/puzzle on Puzzle
// (FinishStart). Nothing is remembered between pages, so the page's HTML and
// the live page always agree and nothing flips once the page's code loads.
// Switching on the page applies to that page (and its swipe view) only.
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { PosterFinish } from "@stickypie/shared";

const listeners = new Set<() => void>();
let current: PosterFinish = "poster";

export function getFinish(): PosterFinish {
  return current;
}

export function setFinish(finish: PosterFinish) {
  current = finish;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The finish a page starts on (its HTML is drawn with it, so nothing flips on load). */
const StartFinish = createContext<PosterFinish>("poster");
let started = false;

/** Wraps a page that starts on a finish: the puzzle poster page starts on Puzzle. */
export function FinishStart({ finish, children }: { finish: PosterFinish; children: ReactNode }) {
  // on the first browser render, before anything reads it, so hydration and the
  // store agree (no flip from Wall poster to Puzzle once the page's code loads)
  if (typeof window !== "undefined" && !started) {
    started = true;
    current = finish;
  }
  return createElement(StartFinish.Provider, { value: finish }, children);
}

/** The current choice; every picker on the page stays in step. */
export function useFinish(): PosterFinish {
  const start = useContext(StartFinish);
  return useSyncExternalStore(subscribe, getFinish, () => start);
}
