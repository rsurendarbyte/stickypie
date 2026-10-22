// Minimum order + distance-based shipping (zones), configured in the admin.
// Browser-safe, no deps: used by the cart UI, checkout page and checkout API.
import { matchIndianState } from "./india";

export type ShippingZone = "local" | "state" | "national" | "remote";

export type StoreSettings = {
  /** Cart subtotal (₹) needed before checkout. */
  minOrder: number;
  /** Where parcels ship from; null until set in the admin. */
  originPincode: string | null;
  originState: string | null;
  /** Shipping fee (₹) per zone. */
  rates: Record<ShippingZone, number>;
  /** Seller details printed on GST invoices. */
  business: BusinessDetails;
  /** Gateway for new checkouts (switched in admin → Settings). */
  paymentGateway: PaymentGateway;
  /** Custom sticker price (₹) per size in inches, e.g. { "3": 49 }; 0 = not offered. */
  customPrices: Record<string, number>;
  /** QR code sticker price (₹) per size, same shape as customPrices. */
  qrPrices: Record<string, number>;
};

export type PaymentGateway = "cashfree" | "razorpay";
export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  cashfree: "Cashfree",
  razorpay: "Razorpay",
};

export type BusinessDetails = {
  name: string | null;
  gstin: string | null;
  address: string | null;
  /** HSN code printed on invoice lines (3919 = self-adhesive plastic). */
  hsn: string;
  /** GST % included in prices (e.g. 18). */
  gstRate: number;
  invoicePrefix: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  minOrder: 900,
  originPincode: null,
  originState: null,
  rates: { local: 40, state: 50, national: 70, remote: 90 },
  business: { name: null, gstin: null, address: null, hsn: "3919", gstRate: 18, invoicePrefix: "SP" },
  paymentGateway: "cashfree",
  customPrices: { "3": 49, "6": 99, "7": 149 },
  qrPrices: { "3": 49, "6": 99, "7": 149 },
};

/** Couriers price these as special / remote zones. */
export const REMOTE_STATES = [
  "Arunachal Pradesh",
  "Assam",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
  "Jammu and Kashmir",
  "Ladakh",
  "Andaman and Nicobar Islands",
  "Lakshadweep",
] as const;

export const ZONE_LABELS: Record<ShippingZone, string> = {
  local: "Same city",
  state: "Within state",
  national: "Rest of India",
  remote: "Remote area",
};

/** Zone for a delivery address, relative to the dispatch PIN code / state. */
export function shippingZone(settings: StoreSettings, pincode: string, state: string): ShippingZone {
  const destState = matchIndianState(state) ?? state;
  const originState = settings.originState ? (matchIndianState(settings.originState) ?? settings.originState) : null;
  const pin = pincode.trim();
  if (settings.originPincode && /^\d{6}$/.test(pin) && pin.slice(0, 3) === settings.originPincode.slice(0, 3)) {
    return "local";
  }
  if (originState && destState === originState) return "state";
  if ((REMOTE_STATES as readonly string[]).includes(destState)) return "remote";
  return "national";
}

/** Shipping fee for an address — always charged (no free shipping). */
export function shippingFor(
  settings: StoreSettings,
  pincode: string,
  state: string
): { zone: ShippingZone; fee: number } {
  const zone = shippingZone(settings, pincode, state);
  return { zone, fee: settings.rates[zone] };
}

/**
 * GST added on top of prices at checkout, on stickers + shipping, rounded to
 * the nearest rupee (the invoice shows the exact tax plus a round-off).
 */
export function gstOnTop(settings: StoreSettings, subtotal: number, shippingFee: number): { rate: number; amount: number } {
  const rate = settings.business.gstRate;
  return { rate, amount: Math.round(((subtotal + shippingFee) * rate) / 100) };
}

/** ₹ still needed to reach the minimum order (0 once reached). */
export function belowMinimum(settings: StoreSettings, subtotal: number): number {
  return Math.max(settings.minOrder - subtotal, 0);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToSettings(r: any): StoreSettings {
  if (!r) return DEFAULT_STORE_SETTINGS;
  return {
    minOrder: Number(r.min_order ?? DEFAULT_STORE_SETTINGS.minOrder),
    originPincode: r.origin_pincode ?? null,
    originState: r.origin_state ?? null,
    rates: {
      local: Number(r.ship_local ?? DEFAULT_STORE_SETTINGS.rates.local),
      state: Number(r.ship_state ?? DEFAULT_STORE_SETTINGS.rates.state),
      national: Number(r.ship_national ?? DEFAULT_STORE_SETTINGS.rates.national),
      remote: Number(r.ship_remote ?? DEFAULT_STORE_SETTINGS.rates.remote),
    },
    business: {
      name: r.business_name ?? null,
      gstin: r.gstin ?? null,
      address: r.business_address ?? null,
      hsn: r.invoice_hsn ?? DEFAULT_STORE_SETTINGS.business.hsn,
      gstRate: r.gst_rate == null ? DEFAULT_STORE_SETTINGS.business.gstRate : Number(r.gst_rate),
      invoicePrefix: r.invoice_prefix ?? DEFAULT_STORE_SETTINGS.business.invoicePrefix,
    },
    paymentGateway: r.payment_gateway === "razorpay" ? "razorpay" : "cashfree",
    customPrices:
      r.custom_prices && typeof r.custom_prices === "object"
        ? Object.fromEntries(Object.entries(r.custom_prices).map(([k, v]) => [k, Number(v) || 0]))
        : DEFAULT_STORE_SETTINGS.customPrices,
    qrPrices:
      r.qr_prices && typeof r.qr_prices === "object"
        ? Object.fromEntries(Object.entries(r.qr_prices).map(([k, v]) => [k, Number(v) || 0]))
        : DEFAULT_STORE_SETTINGS.qrPrices,
  };
}

export function settingsToRow(s: StoreSettings): Record<string, unknown> {
  return {
    min_order: s.minOrder,
    origin_pincode: s.originPincode,
    origin_state: s.originState,
    ship_local: s.rates.local,
    ship_state: s.rates.state,
    ship_national: s.rates.national,
    ship_remote: s.rates.remote,
    business_name: s.business.name,
    gstin: s.business.gstin,
    business_address: s.business.address,
    invoice_hsn: s.business.hsn,
    gst_rate: s.business.gstRate,
    invoice_prefix: s.business.invoicePrefix,
    payment_gateway: s.paymentGateway,
    custom_prices: s.customPrices,
    qr_prices: s.qrPrices,
  };
}
