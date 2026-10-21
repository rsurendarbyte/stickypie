"use client";

// Verifies an Indian PIN code with India Post's public lookup (called straight
// from the browser — no server cost) and returns the city + state it covers.
import { matchIndianState, type IndianState } from "@stickypie/shared";

export type PinLookup =
  | { status: "ok"; city: string; state: IndianState | null; area: string[] }
  | { status: "notfound" }
  | { status: "unavailable" };

const cache = new Map<string, PinLookup>();

export async function lookupPincode(pin: string): Promise<PinLookup> {
  const hit = cache.get(pin);
  if (hit) return hit;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: AbortSignal.timeout(6000),
    });
    const [data] = (await res.json()) as Array<{
      Status: string;
      PostOffice: Array<{ Name: string; District: string; State: string }> | null;
    }>;
    let result: PinLookup;
    if (data?.Status === "Success" && data.PostOffice?.length) {
      const first = data.PostOffice[0];
      result = {
        status: "ok",
        city: first.District,
        state: matchIndianState(first.State),
        area: data.PostOffice.map((o) => o.Name),
      };
    } else {
      result = { status: "notfound" };
    }
    cache.set(pin, result);
    return result;
  } catch {
    // Lookup service down/slow: let the shopper continue with what they typed.
    return { status: "unavailable" };
  }
}
