"use client";

// Phone bottom stack: tab bar → cart strip → install card → help chat tab.
// Each floating layer reports how much room it takes as a CSS variable on
// <html> (--cartstrip, --installbar), and the layers above add those up, so
// they sit on top of each other instead of overlapping. Phones only.
import { useEffect, type RefObject } from "react";

export function useBottomStack(ref: RefObject<HTMLElement | null>, name: "--cartstrip" | "--installbar", extraPx: number, on: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    const phone = window.matchMedia("(max-width: 639px)");
    if (!on || !el) {
      root.style.removeProperty(name);
      return;
    }
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      if (phone.matches && h > 0) root.style.setProperty(name, `${Math.round(h + extraPx)}px`);
      else root.style.removeProperty(name);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    phone.addEventListener("change", apply);
    return () => {
      ro.disconnect();
      phone.removeEventListener("change", apply);
      root.style.removeProperty(name);
    };
  }, [ref, name, extraPx, on]);
}
