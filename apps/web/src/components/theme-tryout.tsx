"use client";

import { useEffect, useState } from "react";
import { SHOP_THEME } from "@stickypie/shared";

/** Lighter / paler versions of a colour, for the gradient's second stop and the picture tint. */
function mix(hex: string, white: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * white));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const KEY = "theme-tryout";

/**
 * Local development only: a floating colour picker that re-colours the shop
 * live, to choose a theme. Copy the values it shows into SHOP_THEME
 * (packages/shared/src/theme.ts) to keep one.
 */
export default function ThemeTryout() {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<string>(SHOP_THEME.brand);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setBrand(saved);
    } catch {}
  }, []);

  const brand2 = mix(brand, 0.3);
  const soft = mix(brand, 0.93);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--theme-brand", brand);
    root.setProperty("--theme-brand2", brand2);
    root.setProperty("--theme-brand-soft", soft);
    try {
      localStorage.setItem(KEY, brand);
    } catch {}
  }, [brand, brand2, soft]);

  const presets = ["#2563eb", "#1e3a8a", "#dc2626", "#9f1239", "#059669", "#0284c7", "#c026d3", "#ea580c", "#7c3aed", "#0d9488", "#18181b", "#ff2e63"];
  const config = `brand: "${brand}",\nbrand2: "${brand2}",\nbrandSoft: "${soft}",`;

  return (
    <div className="fixed bottom-24 left-3 z-[100] text-xs">
      {open ? (
        <div className="w-60 rounded-2xl border border-line bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-bold">Try a theme colour</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="px-1 text-fog">
              ✕
            </button>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {presets.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrand(c)}
                aria-label={c}
                className={`size-8 rounded-lg ring-offset-2 ${c === brand ? "ring-2 ring-snow" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2">
            <input type="color" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-8 w-10" />
            <span className="font-mono">{brand}</span>
          </label>
          <pre className="mt-2 rounded-lg bg-ink2 p-2 font-mono text-[10px] leading-relaxed">{config}</pre>
          <p className="mt-1 text-[10px] text-fog">Tell Claude the colour you like, or copy these into theme.ts.</p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(KEY);
              } catch {}
              setBrand(SHOP_THEME.brand);
            }}
            className="mt-1 text-[10px] font-semibold text-fog underline"
          >
            Reset to theme.ts
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-line bg-white px-3 py-2 font-bold shadow-lg"
        >
          🎨 Theme
        </button>
      )}
    </div>
  );
}
