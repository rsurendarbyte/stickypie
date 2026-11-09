// Server-only: the poster puzzle prize. Solving a poster's puzzle sets a signed
// cookie ("expiry.signature", nothing stored) that checkout turns into 10% off
// one order. The cookie is readable in the browser so checkout can show the
// discount; the signature keeps it from being made up or stretched. Checkout
// also skips it once a paid order with the same phone or email has used it.
import { createHmac } from "node:crypto";
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
