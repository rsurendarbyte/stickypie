"use client";

import { useEffect } from "react";
import { LITE_KEY } from "@/lib/lite-script";

/**
 * Once per visit, after the page settles, counts frames for ~1.5 s. A device
 * that can't hold ~30 fps gets lite mode now and on its next visits.
 */
export default function PerfProbe() {
  useEffect(() => {
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
    const start = window.setTimeout(() => {
      let frames = 0;
      const t0 = performance.now();
      const tick = (now: number) => {
        frames++;
        if (now - t0 < 1500) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const fps = (frames * 1000) / (now - t0);
        if (fps < 30 && document.visibilityState === "visible") {
          root.dataset.lite = "fps";
          try {
            localStorage.setItem(LITE_KEY, "fps");
          } catch {}
        }
      };
      raf = requestAnimationFrame(tick);
    }, 2500);
    return () => {
      window.clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
