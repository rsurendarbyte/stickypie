"use client";

import { useEffect } from "react";
import { LITE_FPS_DAYS, LITE_KEY } from "@/lib/lite-script";

const MEASURE_MS = 2000;
/** Below this the device really is struggling (normal is ~60). */
const SLOW_FPS = 20;

/**
 * Once per visit, after the page has settled, counts frames for 2 s. Only a
 * device that stays clearly slow (< 20 fps) with the tab in view the whole
 * time gets lite mode, remembered for a week and then checked again.
 * Skipped in development, where everything is slower than the live site.
 */
export default function PerfProbe() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const root = document.documentElement;
    // A slow network alone still gets checked: the device itself may be slow too.
    if (root.dataset.lite && root.dataset.lite !== "net") return;
    try {
      if (sessionStorage.getItem(`${LITE_KEY}.probed`)) return;
      sessionStorage.setItem(`${LITE_KEY}.probed`, "1");
    } catch {
      return;
    }
    let raf = 0;
    let interrupted = document.visibilityState !== "visible";
    const onVisibility = () => {
      if (document.visibilityState !== "visible") interrupted = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const start = window.setTimeout(() => {
      let frames = 0;
      const t0 = performance.now();
      const tick = (now: number) => {
        frames++;
        if (now - t0 < MEASURE_MS) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const fps = (frames * 1000) / (now - t0);
        if (fps < SLOW_FPS && !interrupted && document.visibilityState === "visible") {
          root.dataset.lite = "fps";
          try {
            localStorage.setItem(LITE_KEY, String(Date.now() + LITE_FPS_DAYS * 86_400_000));
          } catch {}
        }
      };
      raf = requestAnimationFrame(tick);
    }, 4000);
    return () => {
      window.clearTimeout(start);
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
