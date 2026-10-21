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
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  minOrder: 900,
  originPincode: null,
  originState: null,
  rates: { local: 40, state: 50, national: 70, remote: 90 },
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
  };
}
