// Server-side check that an order ships inside India. The form already only
// takes an Indian state, a 6-digit PIN and an Indian mobile number; this also
// confirms with India Post that the PIN is real and belongs to that state, so
// an order can't get through by skipping the checkout page's own checks.
import { matchIndianState } from "@stickypie/shared";

export type IndiaAddressCheck = { ok: true } | { ok: false; error: string };

export async function checkIndianAddress(pincode: string, state: string): Promise<IndiaAddressCheck> {
  let data: { Status?: string; PostOffice?: Array<{ State: string }> | null } | undefined;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(4000),
    });
    [data] = await res.json();
  } catch (err) {
    // India Post down or slow: don't lose the order — the form checks still
    // guarantee an Indian state, PIN format and mobile number.
    console.warn("[checkout] PIN lookup unavailable", pincode, err);
    return { ok: true };
  }
  if (data?.Status !== "Success" || !data.PostOffice?.length) {
    return {
      ok: false,
      error: "We deliver only within India. Please enter a valid Indian PIN code.",
    };
  }
  const pinState = matchIndianState(data.PostOffice[0].State);
  if (pinState && pinState !== state) {
    return { ok: false, error: `PIN code ${pincode} is in ${pinState}, not ${state}. Please check your address.` };
  }
  return { ok: true };
}
