"use client";

// Browser side of the poster puzzle prize (see puzzle-offer.ts for the server).
import { useSyncExternalStore } from "react";
const CHANGED = "stickypie:puzzle-prize";

function read(): number | null {
  const match = document.cookie.match(/(?:^|;\s*)sp_pz=(\d+)\./);
  const expires = match ? Number(match[1]) : NaN;
  return Number.isFinite(expires) && expires > Date.now() ? expires : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** When this browser's puzzle prize runs out (ms), or null if it has none. */
export function usePuzzlePrize(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Asks the server for the prize after a solve; resolves to its expiry, or null. */
export async function claimPuzzlePrize(): Promise<number | null> {
  try {
    const res = await fetch("/api/puzzle", { method: "POST" });
    const data = (await res.json()) as { expires?: number };
    window.dispatchEvent(new Event(CHANGED));
    return res.ok && typeof data.expires === "number" ? data.expires : null;
  } catch {
    return null;
  }
}
