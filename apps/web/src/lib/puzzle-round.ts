// The poster puzzle's shuffle and its check, the same in the browser and on
// the server. A round's seed comes from the server (signed, see
// puzzle-offer.ts); the game mixes the tiles from it, and to claim the prize
// the browser sends back its swaps, which the server replays on the same mix.

export type Slots = number[];
export const SOLVED: Slots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** More swaps than any real game needs; a claim with more is refused. */
export const MAX_MOVES = 400;

export const isSolved = (s: Slots) => s.every((slot, tile) => slot === tile);

export function swapped(s: Slots, a: number, b: number): Slots {
  const next = [...s];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Small seeded random (FNV-1a hash of the seed into mulberry32). */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let t = h >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A mix with at least 5 tiles out of place, so it never looks nearly done. Seeded → the same on both sides. */
export function mixFrom(random: () => number): Slots {
  for (;;) {
    const s = [...SOLVED];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (s.filter((slot, tile) => slot !== tile).length >= 5) return s;
  }
}

export const seededMix = (seed: string) => mixFrom(seeded(seed));

/** True when these swaps, played on the round's mix, finish the puzzle. */
export function movesSolve(seed: string, moves: unknown): boolean {
  if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_MOVES) return false;
  let slots = seededMix(seed);
  for (const move of moves) {
    if (!Array.isArray(move) || move.length !== 2) return false;
    const [a, b] = move;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a < 0 || b < 0 || a > 8 || b > 8) return false;
    slots = swapped(slots, a, b);
  }
  return isSolved(slots);
}
