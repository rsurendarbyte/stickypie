import { NextResponse } from "next/server";
import { PUZZLE_COOKIE } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { newPuzzlePrize, puzzleCookieOptions, puzzlePrizeFromRequest } from "@/lib/puzzle-offer";

/**
 * A poster puzzle was solved: 10% off one order for the next 24 hours. Solving
 * again keeps the prize this browser already has (it never stretches it).
 * Checkout still allows it only once per phone and email.
 */
export async function POST() {
  if (!(await getDriver().getFeatures()).posterPuzzle) {
    return NextResponse.json({ error: "The puzzle offer has ended." }, { status: 410 });
  }
  const current = await puzzlePrizeFromRequest();
  if (current) return NextResponse.json({ expires: current });
  const prize = newPuzzlePrize();
  const res = NextResponse.json({ expires: prize.expires });
  res.cookies.set(PUZZLE_COOKIE, prize.value, puzzleCookieOptions(prize.expires));
  return res;
}
