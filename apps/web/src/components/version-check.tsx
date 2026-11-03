"use client";

import { useEffect } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;
const RECHECK_MS = 5 * 60 * 1000;
/** Pages where a reload would interrupt the shopper (paying, typing an address). */
const BUSY = /^\/(checkout|pay)/;

/**
 * After a deploy, pages already open (or kept by the browser) still run the
 * old code. This asks for the live version (/build.json, never cached) when
 * the page loads, comes back into view, and every few minutes; when it's
 * newer, the page reloads once to pick it up. The cart lives in the browser,
 * so nothing is lost. Off locally (no build id).
 */
export default function VersionCheck() {
  useEffect(() => {
    if (!BUILD_ID) return;
    let busy = false;
    async function check() {
      if (busy || document.visibilityState !== "visible" || BUSY.test(location.pathname)) return;
      const active = document.activeElement;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      busy = true;
      try {
        const res = await fetch(`/build.json?t=${Date.now()}`, { cache: "no-store" });
        const live = res.ok ? ((await res.json()) as { id?: string }).id : null;
        if (!live || live === BUILD_ID) return;
        // Once per new version, so a stale cache can never loop reloads.
        const key = "sp-reloaded-for";
        try {
          if (sessionStorage.getItem(key) === live) return;
          sessionStorage.setItem(key, live);
        } catch {}
        location.reload();
      } catch {
        // offline or blocked: try again next time
      } finally {
        busy = false;
      }
    }
    check();
    const onShow = () => check();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    const timer = window.setInterval(check, RECHECK_MS);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
