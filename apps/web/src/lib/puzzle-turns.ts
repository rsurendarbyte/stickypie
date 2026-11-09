"use client";

// Poster puzzle loops take turns: only a few posters on screen split and solve
// themselves at a time (a feed of 20 animating cards would stutter on phones):
// one on phones, two on wide screens. A poster that has just come into view
// plays first; after that the on-screen ones take turns in page order. The
// poster page's own poster always goes first while it's in view.
import { useEffect, useId, useSyncExternalStore } from "react";

/** Rest before a finished poster's slot goes to the next one. */
const PAUSE_MS = 500;

const entries = new Map<string, { el: Element; priority: boolean }>();
const visible = new Set<string>();
/** Posters that have played at least once (newcomers go before them). */
const played = new Set<string>();
const current = new Set<string>();
let last: string | null = null;
let timer: number | null = null;
const listeners = new Set<() => void>();
let observer: IntersectionObserver | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

/** How many may play at once: wide screens show more cards. */
const slots = () => (window.innerWidth >= 1024 ? 2 : 1);

function pick() {
  timer = null;
  // On screen and not covered (the poster page lies under the phone swipe view).
  // Anything of its own card counts (a card's whole-card link layer sits on top).
  const onTop = (el: Element) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const scope = el.closest("[data-puzzle-scope]") ?? el.parentElement;
    return !!hit && !!scope?.contains(hit);
  };
  const ids = [...visible].filter((id) => entries.has(id) && !current.has(id) && onTop(entries.get(id)!.el));
  ids.sort((a, b) => (entries.get(a)!.el.compareDocumentPosition(entries.get(b)!.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  let changed = false;
  while (current.size < slots() && ids.length) {
    const priority = current.size ? undefined : ids.find((id) => entries.get(id)!.priority);
    const fresh = ids.find((id) => !played.has(id));
    const after = last ? ids.findIndex((id) => id === last) : -1;
    const next = priority ?? fresh ?? ids[(after + 1) % ids.length];
    ids.splice(ids.indexOf(next), 1);
    current.add(next);
    changed = true;
  }
  if (changed) notify();
  // covered for now (a pop-up, the swipe view): look again later
  else if (visible.size && !current.size) schedule(PAUSE_MS * 4);
}

function schedule(delay: number) {
  if (timer !== null) return;
  timer = window.setTimeout(pick, delay);
}

function getObserver() {
  observer ??= new IntersectionObserver(
    (seen) => {
      let gone = false;
      for (const e of seen) {
        const id = (e.target as HTMLElement).dataset.puzzleTurn;
        if (!id) continue;
        if (e.isIntersecting && e.intersectionRatio >= 0.6) visible.add(id);
        else {
          visible.delete(id);
          if (current.delete(id)) gone = true;
        }
      }
      if (gone) notify();
      schedule(PAUSE_MS / 2);
    },
    { threshold: [0, 0.6, 1] }
  );
  return observer;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** This poster has played its loop: hand its slot on after a rest. */
export function finishTurn(id: string) {
  if (!current.delete(id)) return;
  played.add(id);
  last = id;
  notify();
  schedule(PAUSE_MS);
}

/** Whether `el` may play its puzzle loop now, plus the id to hand back to finishTurn. */
export function usePuzzleTurn(el: Element | null, enabled: boolean, priority = false): { id: string; active: boolean } {
  const id = useId();
  useEffect(() => {
    if (!el || !enabled) return;
    (el as HTMLElement).dataset.puzzleTurn = id;
    entries.set(id, { el, priority });
    const io = getObserver();
    io.observe(el);
    return () => {
      io.unobserve(el);
      entries.delete(id);
      visible.delete(id);
      played.delete(id);
      if (current.delete(id)) {
        notify();
        schedule(PAUSE_MS / 2);
      }
    };
  }, [el, enabled, priority, id]);
  const active = useSyncExternalStore(subscribe, () => current.has(id), () => false);
  return { id, active };
}
