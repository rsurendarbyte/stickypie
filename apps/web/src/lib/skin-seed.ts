"use client";

import { useSyncExternalStore } from "react";

// One random number per visit. The server (and the first hydration pass)
// uses 0, then the client switches to its own value — no hydration mismatch.
// Shop links are full page loads, so the number is kept for the browser tab
// (sessionStorage): coming back to a page (Back, or the Home tab) shows the
// same shuffle; only a fresh visit or a refresh shuffles again.
const KEY = "stickypie.seed";

function pickSeed(): number {
  if (typeof window === "undefined") return 0;
  let reload = false;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    reload = nav?.type === "reload";
  } catch {
    // older browsers: treat as a normal visit
  }
  try {
    const saved = Number(sessionStorage.getItem(KEY));
    if (!reload && saved > 0) return saved;
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    sessionStorage.setItem(KEY, String(seed));
    return seed;
  } catch {
    return Math.floor(Math.random() * 1_000_000) + 1;
  }
}

const clientSeed = pickSeed();
const noop = () => () => {};

/** Today's number, India time: the same for every refresh and every shopper, new at midnight. */
function pickDaySeed(): number {
  if (typeof window === "undefined") return 0;
  const day = Math.floor((Date.now() + 5.5 * 3_600_000) / 86_400_000);
  return Math.imul(day, 2654435761) >>> 0 || 1;
}

const daySeed = pickDaySeed();

/** For rows of products: they change once a day, not on every refresh. */
export function useDaySeed(): number {
  return useSyncExternalStore(noop, () => daySeed, () => 0);
}

/** Random per visit; stays the same while the visitor browses this tab. */
export function useSkinSeed(): number {
  return useSyncExternalStore(noop, () => clientSeed, () => 0);
}
