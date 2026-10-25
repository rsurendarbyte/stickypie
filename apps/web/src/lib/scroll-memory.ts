"use client";

// "Back" should land exactly where the shopper was: same page height and the
// same card in each sideways rail. The browser can't do that by itself here
// because the product lists load after the page appears, so positions are
// saved per page (sessionStorage) and restored once content is ready — only
// when the visit is a back/forward one.
import { useEffect, type RefObject } from "react";

const PREFIX = "stickypie.scroll:";
const pageKey = () => window.location.pathname + window.location.search;

/** The page a back/forward navigation landed on (only that page restores). */
let backTarget: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
/** Set by the in-page Back button just before it navigates. */
let buttonBackAt = 0;

/** Mounted rails/pages that know how to put themselves back. */
const restorers = new Set<() => void>();

function startBack(target: string) {
  backTarget = target;
  buttonBackAt = 0; // the real destination is known now
  clearTimeout(clearTimer);
  // Next.js may render the previous page before or after this runs, so ask
  // everything mounted to restore now; anything mounting shortly after does it
  // on mount.
  setTimeout(() => restorers.forEach((restore) => restore()), 0);
  clearTimer = setTimeout(() => {
    backTarget = null;
  }, 2500);
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => startBack(pageKey()));
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "back_forward") startBack(pageKey());
  } catch {
    // older browsers: no restore on full-page back
  }
}

/** Call right before navigating back from an in-page Back button. */
export function markBackNavigation() {
  buttonBackAt = Date.now();
}

const backActive = () =>
  (backTarget !== null && backTarget === pageKey()) || Date.now() - buttonBackAt < 2500;

function read(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: number) {
  try {
    sessionStorage.setItem(PREFIX + key, String(Math.round(value)));
  } catch {
    // storage unavailable
  }
}

/** Saves window scroll for this page; restores it on back once `ready`. */
export function useWindowScrollMemory(ready: boolean) {
  useEffect(() => {
    const key = pageKey();
    let last: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      // The URL changes before the next page scrolls to the top — never let
      // that overwrite this page's position.
      if (pageKey() !== key) return;
      last = window.scrollY;
      clearTimeout(timer);
      timer = setTimeout(() => write(key, last ?? 0), 120);
    };
    // Tapping anything (a sticker, Back) saves the current spot instantly —
    // even if the browser hasn't delivered the last scroll event yet.
    const saveNow = () => {
      if (pageKey() === key) write(key, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("pointerdown", saveNow, true);
    document.addEventListener("click", saveNow, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", saveNow);
      document.removeEventListener("pointerdown", saveNow, true);
      document.removeEventListener("click", saveNow, true);
      clearTimeout(timer);
      // Leaving the page (tapped a sticker): save right away.
      if (last !== null) write(key, last);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const key = pageKey();
    const restore = () => {
      if (!backActive() || pageKey() !== key) return;
      const y = read(key);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    };
    restorers.add(restore);
    const id = window.setTimeout(restore, 0); // after this render's layout
    return () => {
      restorers.delete(restore);
      window.clearTimeout(id);
    };
  }, [ready]);
}

/** On a back visit, the sideways position a rail had (else null) — so a rail
 *  that draws its cards a few at a time can draw enough to reach it. */
export function savedRailScroll(name: string): number | null {
  return backActive() ? read(`${pageKey()}|${name}`) : null;
}

/** Saves a sideways rail's position; restores it on back (again whenever
 *  `size` changes, as a rail's cards arrive). */
export function useRailScrollMemory(ref: RefObject<HTMLElement | null>, name: string, size = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const page = pageKey();
    const key = `${page}|${name}`;
    const restore = () => {
      if (!backActive() || pageKey() !== page) return;
      const x = read(key);
      if (x !== null) el.scrollLeft = x;
    };
    restore();
    restorers.add(restore);

    let last: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (pageKey() !== page) return;
      last = el.scrollLeft;
      clearTimeout(timer);
      timer = setTimeout(() => write(key, last ?? 0), 120);
    };
    const saveNow = () => {
      if (pageKey() === page) write(key, el.scrollLeft);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", saveNow, true);
    document.addEventListener("click", saveNow, true);
    return () => {
      restorers.delete(restore);
      el.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", saveNow, true);
      document.removeEventListener("click", saveNow, true);
      clearTimeout(timer);
      if (last !== null) write(key, last);
    };
  }, [ref, name, size]);
}
