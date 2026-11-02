import { NextResponse } from "next/server";
import { bestOffer } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { shopperFromRequest } from "@/lib/shopper";

export type MyOffer = { percent: number; expiresAt: string } | null;

/**
 * The signed-in shopper's thank-you offer (approved by the shop from their
 * feedback), shown on their account and at checkout. null = none.
 */
export async function GET(req: Request) {
  const shopper = await shopperFromRequest(req);
  if (!shopper) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const offer = bestOffer(await getDriver().listOpenCouponsFor(shopper.email));
  const body: MyOffer = offer && { percent: offer.percent, expiresAt: offer.expiresAt };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
