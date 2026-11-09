"use client";

// Wall poster or puzzle poster: a mini poster is sold as either (no longer as a
// sticker), and the shopper's choice carries from page to page (kept in this
// browser only). A page can start it (the puzzle poster page starts on Puzzle).
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { PosterFinish } from "@stickypie/shared";

const KEY = "stickypie.finish.v1";
const listeners = new Set<() => void>();
let current: PosterFinish = "poster";
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (localStorage.getItem(KEY) === "puzzle") current = "puzzle";
  } catch {
    // storage may be blocked; the default stands
  }
}

export function getFinish(): PosterFinish {
  load();
  return current;
}

export function setFinish(finish: PosterFinish) {
  current = finish;
  try {
    localStorage.setItem(KEY, finish);
  } catch {
    // still applies for this visit
  }
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
    loaded = true;
    current = finish;
    try {
      localStorage.setItem(KEY, finish);
    } catch {}
  }
  return createElement(StartFinish.Provider, { value: finish }, children);
}

/** The current choice; every picker on the page stays in step. */
export function useFinish(): PosterFinish {
  const start = useContext(StartFinish);
  return useSyncExternalStore(subscribe, getFinish, () => start);
}
