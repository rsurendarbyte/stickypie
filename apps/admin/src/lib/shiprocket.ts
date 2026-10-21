// Shiprocket API client (server-only, admin app). Credentials come from the
// admin env files — an "API user" created in Shiprocket → Settings → API:
//   SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD
//   SHIPROCKET_PICKUP_LOCATION  (pickup address nickname in Shiprocket, e.g. "Primary")
//   SHIPROCKET_API_BASE         (optional; defaults to the live API)
// No path aliases here on purpose: scripts can import this file directly.
import type { Order } from "@stickypie/shared";

export type ShiprocketConfig = { email: string; password: string; pickupLocation: string; base: string };

export function shiprocketConfig(): ShiprocketConfig | null {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!email || !password || !pickupLocation) return null;
  const base = (process.env.SHIPROCKET_API_BASE ?? "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");
  return { email, password, pickupLocation, base };
}

let cached: { token: string; until: number; key: string } | null = null;

async function login(cfg: ShiprocketConfig): Promise<string> {
  const res = await fetch(`${cfg.base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !data.token) {
    throw new Error(`Shiprocket login failed: ${data.message ?? res.status} — check the API user in the admin env file`);
  }
  // Tokens last 10 days; refresh a day early.
  cached = { token: data.token, until: Date.now() + 9 * 86_400_000, key: cfg.email };
  return data.token;
}

/** Turns a Shiprocket error body into one readable line. */
function describe(data: unknown, status: number): string {
  const d = data as { message?: string; errors?: Record<string, string[] | string> } | null;
  const details = d?.errors
    ? Object.values(d.errors)
        .flat()
        .filter(Boolean)
        .join("; ")
    : "";
  return [d?.message, details].filter(Boolean).join(" — ") || `Shiprocket error ${status}`;
}

async function call<T>(cfg: ShiprocketConfig, path: string, body?: unknown, retried = false): Promise<T> {
  const token = cached && cached.key === cfg.email && cached.until > Date.now() ? cached.token : await login(cfg);
  const res = await fetch(`${cfg.base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401 && !retried) {
    cached = null;
    return call<T>(cfg, path, body, true);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describe(data, res.status));
  return data as T;
}

export type Parcel = { weightKg: number; lengthCm: number; breadthCm: number; heightCm: number };

const ist = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

/** Creates the Shiprocket order (prepaid) for one of our orders. */
export async function createShiprocketOrder(
  cfg: ShiprocketConfig,
  order: Order,
  parcel: Parcel,
  hsn: string
): Promise<{ orderId: string; shipmentId: string }> {
  const [first, ...rest] = order.customerName.trim().split(/\s+/);
  const data = await call<{ order_id?: number | string; shipment_id?: number | string; message?: string }>(
    cfg,
    "/orders/create/adhoc",
    {
      order_id: order.id,
      order_date: ist(order.paidAt ?? order.createdAt),
      pickup_location: cfg.pickupLocation,
      billing_customer_name: first,
      billing_last_name: rest.join(" "),
      billing_address: order.address1,
      billing_address_2: order.address2 ?? "",
      billing_city: order.city,
      billing_pincode: order.pincode,
      billing_state: order.state,
      billing_country: "India",
      billing_email: order.email,
      billing_phone: order.phone,
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({
        name: item.sizeInches ? `${item.name} (${item.sizeInches} in)` : item.name,
        sku: `${(item.productId ?? item.id).slice(0, 8)}-${item.sizeInches ?? "std"}`,
        units: item.quantity,
        selling_price: item.unitPrice,
        discount: 0,
        tax: 0,
        hsn,
      })),
      payment_method: "Prepaid",
      shipping_charges: order.shippingFee,
      sub_total: order.subtotal,
      length: parcel.lengthCm,
      breadth: parcel.breadthCm,
      height: parcel.heightCm,
      weight: parcel.weightKg,
    }
  );
  if (!data.order_id || !data.shipment_id) throw new Error(data.message ?? "Shiprocket didn't return a shipment");
  return { orderId: String(data.order_id), shipmentId: String(data.shipment_id) };
}

export type CourierQuote = { id: number; name: string; rate: number; days: number | null };

/** Slowest delivery we accept when picking the cheapest courier. */
const MAX_DELIVERY_DAYS = 7;

/**
 * Cheapest courier for a Shiprocket order that delivers within a week (ties →
 * the faster one). Falls back to the cheapest overall if none is that quick.
 */
export async function cheapestCourier(cfg: ShiprocketConfig, shiprocketOrderId: string): Promise<CourierQuote | null> {
  const data = await call<{
    data?: {
      available_courier_companies?: Array<{
        courier_company_id: number;
        courier_name: string;
        rate: number | string;
        estimated_delivery_days?: number | string;
        blocked?: number;
      }>;
    };
  }>(cfg, `/courier/serviceability?order_id=${encodeURIComponent(shiprocketOrderId)}`);
  const quotes: CourierQuote[] = (data.data?.available_courier_companies ?? [])
    .filter((c) => !c.blocked)
    .map((c) => {
      const days = Number(c.estimated_delivery_days);
      return {
        id: c.courier_company_id,
        name: c.courier_name,
        rate: Number(c.rate),
        days: Number.isFinite(days) && days > 0 ? days : null,
      };
    })
    .filter((q) => Number.isFinite(q.rate));
  const byPrice = (a: CourierQuote, b: CourierQuote) => a.rate - b.rate || (a.days ?? 99) - (b.days ?? 99);
  const quick = quotes.filter((q) => q.days !== null && q.days <= MAX_DELIVERY_DAYS).sort(byPrice);
  return quick[0] ?? quotes.sort(byPrice)[0] ?? null;
}

/** Books a courier → AWB: the given one, or Shiprocket's recommendation. */
export async function assignAwb(
  cfg: ShiprocketConfig,
  shipmentId: string,
  courierId?: number
): Promise<{ awb: string; courier: string }> {
  const data = await call<{
    awb_assign_status?: number;
    message?: string;
    response?: { data?: { awb_code?: string; courier_name?: string; awb_assign_error?: string } };
  }>(cfg, "/courier/assign/awb", { shipment_id: shipmentId, ...(courierId ? { courier_id: courierId } : {}) });
  const info = data.response?.data;
  if (data.awb_assign_status !== 1 || !info?.awb_code) {
    throw new Error(info?.awb_assign_error ?? data.message ?? "Shiprocket couldn't assign a courier");
  }
  return { awb: info.awb_code, courier: info.courier_name ?? "Courier" };
}

/** Asks the courier to collect the parcel. Already-scheduled is fine. */
export async function schedulePickup(cfg: ShiprocketConfig, shipmentId: string): Promise<string | null> {
  try {
    const data = await call<{ response?: { pickup_scheduled_date?: string } }>(cfg, "/courier/generate/pickup", {
      shipment_id: [shipmentId],
    });
    return data.response?.pickup_scheduled_date ?? null;
  } catch (err) {
    if (/already/i.test(err instanceof Error ? err.message : "")) return null;
    throw err;
  }
}

/** Printable shipping label (PDF URL). */
export async function shippingLabel(cfg: ShiprocketConfig, shipmentId: string): Promise<string | null> {
  const data = await call<{ label_created?: number; label_url?: string }>(cfg, "/courier/generate/label", {
    shipment_id: [shipmentId],
  });
  return data.label_url ?? null;
}
