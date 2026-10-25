"use client";

// Phone back button / swipe-back closes the top pop-up (actual size, details
// sheet, cart, menus) instead of leaving the page: each open pop-up adds one
// history step with the same address. Closing it by its own button, Esc or a
// tap outside removes that step again, so history stays clean.
import { useEffect, useRef } from "react";

/** Open pop-ups, oldest first; only the top one closes on back. */
const stack: string[] = [];
/** A step left by a pop-up that unmounted a moment ago (React may remount it at once). */
let orphan: string | null = null;

// The browser's own history methods: Next.js wraps window.history.pushState and
// re-renders the page on it, which would close the pop-up straight away. Its
// state is kept (spread), so Next treats the extra step as its own.
const push = (state: unknown) => History.prototype.pushState.call(window.history, state, "");
const replace = (state: unknown) => History.prototype.replaceState.call(window.history, state, "");

export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    stack.push(id);
    if (orphan && window.history.state?.overlay === orphan) {
      // remounted straight away (React dev mode): reuse its step
      replace({ ...window.history.state, overlay: id });
      orphan = null;
    } else push({ ...window.history.state, overlay: id });

    let closedByBack = false;
    const onPop = () => {
      // back pressed while this is the top pop-up (and its step is gone)
      if (stack[stack.length - 1] === id && window.history.state?.overlay !== id) {
        closedByBack = true;
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      stack.splice(stack.indexOf(id), 1);
      if (closedByBack) return;
      // closed some other way: take back the step it added, unless it's remounted
      orphan = id;
      setTimeout(() => {
        if (orphan !== id) return;
        orphan = null;
        if (window.history.state?.overlay === id) window.history.back();
      }, 0);
    };
  }, [open]);
}
