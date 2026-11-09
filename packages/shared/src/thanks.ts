// Thank-you card in the parcel → QR → feedback without signing in → the shop
// reads it in admin and approves a next-order offer (its own %) for that
// customer. The offer then shows on their account and is applied by itself at
// their next checkout, once. Nothing is shown or emailed before approval.
// Browser-safe.

/** How long an approved offer stays usable. */
export const REWARD_VALID_DAYS = 60;

export type Coupon = {
  id: string;
  /** Internal reference (admin and invoice); customers never type it. */
  code: string;
  percent: number;
  /** The order whose feedback earned it. */
  sourceOrderId: string;
  /** Only this customer gets it: the account email they check out with. */
  email: string;
  phone: string;
  expiresAt: string;
  /** Set once the order that used it is paid. */
  usedOrderId: string | null;
  usedAt: string | null;
  /** Turned off, or the admin chose "no offer" for this feedback. */
  disabled: boolean;
  createdAt: string;
};

export type NewCouponInput = Pick<Coupon, "code" | "percent" | "sourceOrderId" | "email" | "phone" | "expiresAt"> & {
  disabled?: boolean;
};

/** "THANKS-7K2Q9M" — no 0/O/1/I so it reads cleanly. */
export function makeCouponCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `THANKS-${Array.from(bytes, (b) => abc[b % abc.length]).join("")}`;
}

/** ₹ off the sticker subtotal. */
export function couponDiscount(subtotal: number, percent: number): number {
  return Math.round((subtotal * percent) / 100);
}

/** Discount code on orders that used the poster puzzle prize (once per phone and email). */
export const PUZZLE_CODE = "PUZZLE10";
export const PUZZLE_PERCENT = 10;
/** How long a solved puzzle's prize waits for checkout. */
export const PUZZLE_HOURS = 24;
/** Browser cookie holding a solved puzzle's prize ("expiry.signature"). */
export const PUZZLE_COOKIE = "sp_pz";

/** The approved offer used at checkout: the biggest, then the oldest. */
export function bestOffer(open: Coupon[]): Coupon | null {
  return [...open].sort((a, b) => b.percent - a.percent || a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

/** The QR on the card: the order page, opened on its feedback box. */
export function feedbackLink(shopUrl: string, orderId: string, token: string): string {
  return `${shopUrl.replace(/\/+$/, "")}/order/${orderId}?fb=${token}#feedback`;
}

/** Constant-time-ish compare for the link key. */
export function sameToken(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToCoupon(r: any): Coupon {
  return {
    id: r.id,
    code: r.code,
    percent: Number(r.percent),
    sourceOrderId: r.source_order_id,
    email: r.email,
    phone: r.phone,
    expiresAt: r.expires_at,
    usedOrderId: r.used_order_id ?? null,
    usedAt: r.used_at ?? null,
    disabled: Boolean(r.disabled),
    createdAt: r.created_at,
  };
}
