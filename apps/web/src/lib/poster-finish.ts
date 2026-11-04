"use client";

// Wall poster or sticker: a mini poster is sold as either, and the shopper's
// choice carries from page to page (kept in this browser only).
import { useSyncExternalStore } from "react";
import type { PosterFinish } from "@stickypie/shared";

const KEY = "stickypie.finish.v1";
const listeners = new Set<() => void>();
let current: PosterFinish = "poster";
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (localStorage.getItem(KEY) === "sticker") current = "sticker";
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

/** The current choice; every picker on the page stays in step. */
export function useFinish(): PosterFinish {
  return useSyncExternalStore(subscribe, getFinish, () => "poster");
}
