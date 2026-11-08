import { NextResponse } from "next/server";
import { getDriver } from "@/lib/data";
import { shopperFromRequest } from "@/lib/shopper";

/**
 * Guest orders placed with the signed-in shopper's email move onto their
 * account, so they show in My orders. Only for a confirmed email: anyone can
 * type an email at guest checkout, but only its owner can confirm it.
 */
export async function POST(req: Request) {
  const shopper = await shopperFromRequest(req);
  if (!shopper) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!shopper.confirmed) return NextResponse.json({ claimed: 0 });
  try {
    const claimed = await getDriver().claimGuestOrders(shopper.email, shopper.id);
    return NextResponse.json({ claimed });
  } catch (err) {
    console.error("[claim-orders]", err);
    return NextResponse.json({ error: "Couldn't move your orders. Please try again." }, { status: 502 });
  }
}
