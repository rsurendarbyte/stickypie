// Server-only: the poster puzzle prize. Solving a poster's puzzle sets a signed
// cookie ("expiry.signature", nothing stored) that checkout turns into 10% off
// one order. The cookie is readable in the browser so checkout can show the
// discount; the signature keeps it from being made up or stretched. Checkout
// also skips it once a paid order with the same phone or email has used it.
import { createHmac, randomBytes } from "node:crypto";
import { movesSolve } from "./puzzle-round";
import { PUZZLE_COOKIE, PUZZLE_HOURS, sameToken } from "@stickypie/shared";

function sign(expires: number): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(`poster-puzzle:${expires}`)
    .digest("hex")
    .slice(0, 32);
}

/** A new prize cookie value, good for PUZZLE_HOURS. */
export function newPuzzlePrize(now = Date.now()): { value: string; expires: number } {
  const expires = now + PUZZLE_HOURS * 60 * 60_000;
  return { value: `${expires}.${sign(expires)}`, expires };
}

/** The prize's expiry when the cookie is genuine and still good, else null. */
export function puzzlePrizeExpiry(value: string | undefined, now = Date.now()): number | null {
  const [raw, sig] = (value ?? "").split(".");
  const expires = Number(raw);
  if (!Number.isFinite(expires) || expires <= now || !sameToken(sig, sign(expires))) return null;
  return expires;
}

export async function puzzlePrizeFromRequest(): Promise<number | null> {
  const { cookies } = await import("next/headers");
  return puzzlePrizeExpiry((await cookies()).get(PUZZLE_COOKIE)?.value);
}

export const puzzleCookieOptions = (expires: number) => ({
  httpOnly: false,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  expires: new Date(expires),
});

// A round: the server picks the shuffle's seed and signs it with the time it
// was given out ("issued.seed.signature"). A prize needs a round's swaps that
// really solve that shuffle, and no sooner than a person could.
const ROUND_MIN_MS = 3000;
const ROUND_MAX_MS = 2 * 60 * 60_000;

function signRound(issued: number, seed: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(`poster-puzzle-round:${issued}:${seed}`)
    .digest("hex")
    .slice(0, 32);
}

/** A new round token and the seed the game mixes from. */
export function newPuzzleRound(now = Date.now()): { round: string; seed: string } {
  const seed = randomBytes(9).toString("base64url");
  return { round: `${now}.${seed}.${signRound(now, seed)}`, seed };
}

/** True when `round` is genuine, old enough and not stale, and `moves` solve its shuffle. */
export function puzzleRoundSolved(round: unknown, moves: unknown, now = Date.now()): boolean {
  if (typeof round !== "string" || round.length > 120) return false;
  const [raw, seed, sig] = round.split(".");
  const issued = Number(raw);
  if (!Number.isFinite(issued) || !seed || !sameToken(sig, signRound(issued, seed))) return false;
  const age = now - issued;
  if (age < ROUND_MIN_MS || age > ROUND_MAX_MS) return false;
  return movesSolve(seed, moves);
}
