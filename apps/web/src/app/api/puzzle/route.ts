import { NextResponse } from "next/server";
import { PUZZLE_COOKIE } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import {
  newPuzzlePrize,
  newPuzzleRound,
  puzzleCookieOptions,
  puzzlePrizeFromRequest,
  puzzleRoundSolved,
} from "@/lib/puzzle-offer";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** A new game: the signed round whose seed the tiles are mixed from. */
export function GET() {
  const { round, seed } = newPuzzleRound();
  return NextResponse.json({ round, seed }, { headers: NO_STORE });
}

/**
 * A poster puzzle was solved: the prize (admin's percent off puzzle posters)
 * for the next 24 hours. The body carries the round and the swaps played; the
 * server replays them on that round's mix, so the prize can't be had without
 * solving. Solving again keeps the prize this browser already has (it never
 * stretches it). Checkout still allows it only once per phone and email.
 */
export async function POST(req: Request) {
  if (!(await getDriver().getFeatures()).posterPuzzle) {
    return NextResponse.json({ error: "The puzzle offer has ended." }, { status: 410 });
  }
  const current = await puzzlePrizeFromRequest();
  if (current) return NextResponse.json({ expires: current });
  const body = (await req.json().catch(() => null)) as { round?: unknown; moves?: unknown } | null;
  if (!puzzleRoundSolved(body?.round, body?.moves)) {
    return NextResponse.json({ error: "Solve the puzzle to unlock the prize." }, { status: 400 });
  }
  const prize = newPuzzlePrize();
  const res = NextResponse.json({ expires: prize.expires });
  res.cookies.set(PUZZLE_COOKIE, prize.value, puzzleCookieOptions(prize.expires));
  return res;
}
