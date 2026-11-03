// Shop logins for the admin's Customers pages, from the admin_customers() /
// admin_customer() database functions (admin-only; they read Supabase's auth tables).
import { createServerSupabase } from "./supabase";

export type Customer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_admin: boolean;
  sessions: number;
  seen_at: string | null;
  last_active_at: string | null;
  orders: number;
  paid_orders: number;
  spent: number;
  last_order_at: string | null;
  addresses: number;
  reviews: number;
};

export type CustomerSession = {
  created_at: string;
  seen_at: string;
  user_agent: string | null;
  ip: string | null;
};

export type CustomerEvent = {
  at: string;
  kind: "signup" | "login" | "logout" | "order" | "paid" | "delivered" | "review" | "message" | "address";
  title: string;
  detail: string | null;
  ref: string | null;
};

export type LoginStatus = "online" | "signed-in" | "signed-out" | "blocked";

// The shop refreshes a live session about once an hour while a tab is open.
const ONLINE_MS = 70 * 60_000;

export function loginStatus(c: Pick<Customer, "banned_until" | "sessions" | "seen_at">): LoginStatus {
  const now = Date.now();
  if (c.banned_until && new Date(c.banned_until).getTime() > now) return "blocked";
  if (c.sessions > 0 && c.seen_at && now - new Date(c.seen_at).getTime() < ONLINE_MS) return "online";
  return c.sessions > 0 ? "signed-in" : "signed-out";
}

export const STATUS_TEXT: Record<LoginStatus, string> = {
  online: "Online now",
  "signed-in": "Signed in",
  "signed-out": "Signed out",
  blocked: "Blocked",
};

export async function listCustomers(): Promise<Customer[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_customers");
  if (error) throw new Error(error.message);
  return (data ?? []) as Customer[];
}

export async function getCustomer(
  id: string,
): Promise<{ customer: Customer; sessions: CustomerSession[]; events: CustomerEvent[] } | null> {
  const supabase = await createServerSupabase();
  const [all, detail] = await Promise.all([
    listCustomers(),
    supabase.rpc("admin_customer", { p_user: id }),
  ]);
  if (detail.error) throw new Error(detail.error.message);
  const customer = all.find((c) => c.id === id);
  if (!customer || !detail.data) return null;
  const { sessions, events } = detail.data as { sessions: CustomerSession[]; events: CustomerEvent[] };
  return { customer, sessions, events };
}

/** "5 min ago", "3 h ago", "2 days ago", else a date — always Indian time. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: d > 300 ? "numeric" : undefined,
    timeZone: "Asia/Kolkata",
  });
}

/** "iPhone · Instagram" from a browser's user-agent string. */
export function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const device = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android phone"
        : /Windows/.test(ua)
          ? "Windows PC"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux PC"
              : "Unknown device";
  const app = /Instagram/.test(ua)
    ? "Instagram"
    : /FBAN|FBAV/.test(ua)
      ? "Facebook"
      : /EdgA?\//.test(ua)
        ? "Edge"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /Firefox|FxiOS/.test(ua)
            ? "Firefox"
            : /Chrome|CriOS/.test(ua)
              ? "Chrome"
              : /Safari/.test(ua)
                ? "Safari"
                : null;
  return app ? `${device} · ${app}` : device;
}
