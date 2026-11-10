"use client";

import { useSyncExternalStore } from "react";

// One random number per visit. The server (and the first hydration pass)
// uses 0, then the client switches to its own value — no hydration mismatch.
// Shop links are full page loads, so the number is kept for the browser tab
// (sessionStorage): coming back to a page (Back, or the Home tab) shows the
// same shuffle; only a fresh visit or a refresh shuffles again.
const KEY = "stickypie.seed";

/**
 * Runs in <head> before anything is drawn (app/layout.tsx): window.__visitSeed,
 * new on a refresh or a fresh visit, the same as last time on Back / Forward
 * (and while browsing the tab). Everything random on a page (puzzle cards, the
 * hero fan, card colours, "related" order) comes from it, so going back shows
 * the page exactly as it was; only a refresh shuffles.
 */
export const VISIT_SEED_SCRIPT = `try{var k="${KEY}",n=performance.getEntriesByType("navigation")[0],v=+sessionStorage.getItem(k);if(!(n&&n.type!=="reload"&&v>0)){v=Math.floor(Math.random()*1e6)+1;sessionStorage.setItem(k,v)}window.__visitSeed=v}catch(e){window.__visitSeed=Math.floor(Math.random()*1e6)+1}`;

function pickSeed(): number {
  if (typeof window === "undefined") return 0;
  const early = (window as { __visitSeed?: number }).__visitSeed;
  if (typeof early === "number" && early > 0) return early;
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

/** This visit's seed outside React (0 on the server): new on refresh, the same on Back. */
export function visitSeed(): number {
  return clientSeed;
}

/** A steady 0–1 number from this visit's seed and a name (different names, different numbers). */
export function visitChance(name: string): number {
  let h = clientSeed ^ 0x9e3779b9;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x85ebca6b);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
