"use client";

// "Back" should land exactly where the shopper was: same page height and the
// same card in each sideways rail. The browser can't do that by itself here
// because the product lists load after the page appears (it would jump to
// where the short page ends: the footer), so positions are saved per page
// (sessionStorage) and restored by us — only when the visit is a back/forward
// one. The page is held at its old height while its lists load, and put back
// on the spot as they fill in, until the shopper scrolls themselves.
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
  holding = null;
  buttonBackAt = 0; // the real destination is known now
  clearTimeout(clearTimer);
  // Next.js may render the previous page before or after this runs, so ask
  // everything mounted to restore now; anything mounting shortly after does it
  // on mount.
  setTimeout(() => restorers.forEach((restore) => restore()), 0);
  // long enough for a slow network to bring the lists in
  clearTimer = setTimeout(() => {
    backTarget = null;
  }, 12000);
}

if (typeof window !== "undefined") {
  // the browser's own restore lands on the footer of the still-short page
  try {
    window.history.scrollRestoration = "manual";
  } catch {}
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
  (backTarget !== null && backTarget === pageKey()) || Date.now() - buttonBackAt < 12000;

/** The page being put back right now (once per back visit). */
let holding: string | null = null;

/**
 * Back on a page whose lists are still loading: hold the page at least as tall
 * as it was (so the spot exists and the footer stays out of sight), scroll
 * there, and keep it there as the lists fill in. Ends when the content itself
 * reaches the spot, after 10s, or as soon as the shopper scrolls or taps.
 */
function holdAt(key: string, y: number) {
  if (holding === key || y <= 0) return;
  holding = key;
  const main = document.querySelector("main");
  if (main) main.style.minHeight = `${y + window.innerHeight}px`;
  const started = Date.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (main) main.style.minHeight = "";
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.removeEventListener(type, finish, true);
  };
  // the shopper takes over: stop steering
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(type, finish, { capture: true, passive: true });
  const tick = () => {
    if (done || pageKey() !== key) return finish();
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    const content = main?.firstElementChild?.getBoundingClientRect().height ?? 0;
    if (content >= y + window.innerHeight * 0.6 || Date.now() - started > 10000) {
      // one last nudge after the final layout, then let go
      window.setTimeout(() => {
        if (!done && pageKey() === key && Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        finish();
      }, 250);
      return;
    }
    window.setTimeout(tick, 80);
  };
  tick();
}

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

/** Saves window scroll for this page; restores it on back (held until `ready` content fills in). */
export function useWindowScrollMemory(ready: boolean) {
  useEffect(() => {
    const key = pageKey();
    // a back visit: put the page back now, not once the lists have loaded
    if (backActive()) {
      const y = read(key);
      if (y !== null) holdAt(key, y);
    }
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
      if (y !== null) holdAt(key, y);
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

/** A choice on the page (a wall theme chip): kept like the scroll spot, read back only on a back visit. */
export function rememberChoice(name: string, value: string) {
  try {
    sessionStorage.setItem(`${PREFIX}${pageKey()}|${name}|choice`, value);
  } catch {
    // storage unavailable
  }
}

export function savedChoice(name: string): string | null {
  if (!backActive()) return null;
  try {
    return sessionStorage.getItem(`${PREFIX}${pageKey()}|${name}|choice`);
  } catch {
    return null;
  }
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
