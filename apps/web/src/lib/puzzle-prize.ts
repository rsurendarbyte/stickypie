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

export type PuzzleRound = { round: string; seed: string };

/** A new game round from the server (the seed the tiles are mixed from), or null offline. */
export async function fetchPuzzleRound(): Promise<PuzzleRound | null> {
  try {
    const res = await fetch("/api/puzzle", { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const data = (await res.json()) as Partial<PuzzleRound>;
    return res.ok && typeof data.round === "string" && typeof data.seed === "string"
      ? { round: data.round, seed: data.seed }
      : null;
  } catch {
    return null;
  }
}

/**
 * Asks the server for the prize after a solve, sending the round and the swaps
 * played (the server replays them). Resolves to the prize's expiry, "ended"
 * when the offer is switched off (410), or "failed" when it couldn't be
 * unlocked this time (weak network, or a game that had to mix without a round).
 */
export async function claimPuzzlePrize(round: PuzzleRound | null, moves: [number, number][]): Promise<number | "ended" | "failed"> {
  // a slow network mustn't leave "Unlocking your prize…" up for long: 6s a try, two tries
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round: round?.round, moves }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 410) return "ended";
      const data = (await res.json().catch(() => ({}))) as { expires?: number };
      window.dispatchEvent(new Event(CHANGED));
      return res.ok && typeof data.expires === "number" ? data.expires : "failed";
    } catch {
      // timed out or offline: try once more
    }
  }
  return "failed";
}
