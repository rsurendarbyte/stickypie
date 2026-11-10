// Shopper journeys for the admin's Journeys page, from admin_journeys() (one row
// per visit, written by the shop through /api/journey). Grouped here by visitor
// (one browser = one guest) and put into plain words for the page.
import type { CartLine } from "./carts";
import { supabaseConfigured } from "./auth";
import { createServerSupabase } from "./supabase";

export type JourneyPage = { i: number; p: string; t: number; ms: number };
export type JourneyEvent = { e: string; t: number; p: string; d?: Record<string, string | number | boolean | null> | null };

export type JourneySession = {
  id: string;
  visitor_id: string;
  visit_no: number;
  started_at: string;
  last_at: string;
  entry_path: string | null;
  source: string | null;
  campaign: string | null;
  referrer: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  from_ad: boolean | null;
  device: string | null;
  screen: string | null;
  lang: string | null;
  place: string | null;
  cart_token: string | null;
  order_id: string | null;
  pages: JourneyPage[];
  events: JourneyEvent[];
  last_path: string | null;
  added_to_cart: boolean;
  opened_checkout: boolean;
  pay_clicked: boolean;
  paid: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_at: string | null;
  /** This browser's unpaid cart now. */
  cart_items: CartLine[] | null;
  cart_value: number | null;
  /** This visitor's visits in all (not only those loaded). */
  visits: number;
  first_at: string;
};

export type Visitor = {
  id: string;
  sessions: JourneySession[]; // newest first
  visits: number;
  firstAt: string;
  lastAt: string;
  totalMs: number;
  pageCount: number;
  added: boolean;
  checkout: boolean;
  payClicked: boolean;
  paid: boolean;
  orderId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  cart: CartLine[] | null;
  cartValue: number | null;
  addedCount: number;
  /** What they put in the cart, from their steps (when the saved cart isn't there). */
  addedItems: { name: string; price: number | null }[];
  /** Plain words: "Instagram ad", "Android phone · Instagram app", "Pune, Maharashtra". */
  source: string;
  device: string;
  place: string | null;
  /** First visit's facts. */
  first: JourneySession;
  /** Where they got to and stopped: "Checkout · filling the address". */
  leftAt: string;
  stage: "paid" | "payment" | "checkout" | "cart" | "browsing";
};

export const JOURNEY_RANGES = [
  { id: "1", label: "Today + yesterday", days: 2 },
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
] as const;

export async function listJourneys(days: number): Promise<JourneySession[]> {
  if (!supabaseConfigured()) return [];
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_journeys", { p_days: days, p_limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? []) as JourneySession[];
}

export const sessionMs = (s: JourneySession) => s.pages.reduce((sum, p) => sum + (p.ms || 0), 0);

/* ── plain words ─────────────────────────────────────────────────────────── */

const title = (slug: string) =>
  slug
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

/** "/sticker/cool-frenchie-mini-poster" → "Cool frenchie poster". */
export function pageName(path: string): string {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return "Home";
  if (p === "/checkout") return "Checkout";
  if (p === "/account") return "Account";
  if (p === "/stickers") return "All stickers";
  if (p === "/wall-posters") return "Wall posters";
  if (p === "/puzzle-posters") return "Puzzle posters";
  if (p.startsWith("/order/")) return "Order page";
  if (p.startsWith("/pay/")) return "Payment page";
  const m = p.match(/^\/sticker\/(.+)$/);
  if (m) {
    const slug = m[1];
    if (/-mini-poster$/.test(slug)) return `${title(slug.replace(/-mini-poster$/, ""))} poster`;
    if (/-(wall-setup|poster-pack)$/.test(slug)) return `${title(slug.replace(/-(wall-setup|poster-pack)$/, ""))} wall set`;
    return `${title(slug)} sticker`;
  }
  const puzzle = p.match(/^\/puzzle\/(.+)$/);
  if (puzzle) return `Puzzle game: ${title(puzzle[1].replace(/-mini-poster$/, ""))}`;
  const cat = p.match(/^\/stickers\/(.+)$/);
  if (cat) return `${title(cat[1])} list`;
  return `${title(p.slice(1).split("/")[0])} page`;
}

export function sourceLabel(s: JourneySession): string {
  const src = (s.source ?? "direct").toLowerCase();
  const ad = Boolean(s.from_ad);
  if (/^(instagram|ig)/.test(src)) return ad ? "Instagram ad" : "Instagram";
  if (/^(facebook|fb)/.test(src)) return ad ? "Facebook ad" : "Facebook";
  if (src.startsWith("meta")) return "Meta ad";
  if (src.startsWith("google")) return ad ? "Google ad" : "Google search";
  if (src === "direct") return ad ? "Ad link" : "Opened the site directly";
  return `${title(src)}${ad && !/ ad$/.test(src) ? " ad" : ""}`;
}

/** "Android · Instagram app" → "Android phone · Instagram app". */
export function deviceLabel(device: string | null): string {
  if (!device) return "Unknown device";
  const [os, app] = device.split(" · ");
  const kind = os === "Android" ? "Android phone" : os === "Desktop" ? "Computer" : os;
  return app && app !== "Browser" ? `${kind} · ${app}` : kind;
}

export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "Today 9:40 pm", "Yesterday 11:02 am", "3 Nov 6:15 pm" (India time). */
export function dayTime(t: string | number): string {
  const d = new Date(t);
  const ist = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).toLowerCase();
  const today = ist(new Date());
  const yesterday = ist(new Date(Date.now() - 86_400_000));
  const day = ist(d) === today ? "Today" : ist(d) === yesterday ? "Yesterday" : d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  return `${day} ${time}`;
}

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  email: "email",
  tel: "mobile",
  phone: "mobile",
  "postal-code": "PIN code",
  pincode: "PIN code",
  pincode_not_found: "PIN not found",
  city: "city",
  state: "state",
  "address-line1": "house / street",
  address1: "house / street",
  "address-line2": "area",
  password: "password",
};
export const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;
const fieldList = (v: unknown) => String(v ?? "").split(",").filter(Boolean).map(fieldLabel).join(", ");

const inr = (v: unknown) => (typeof v === "number" ? ` ₹${v.toLocaleString("en-IN")}` : "");

/** One step of the timeline in plain words. */
export function eventLabel(ev: JourneyEvent): string {
  const d = ev.d ?? {};
  switch (ev.e) {
    case "add_to_cart":
      return `Added to cart: ${d.name ?? "an item"}${inr(d.price)}`;
    case "open_cart":
      return "Looked at the cart";
    case "checkout":
      return `Opened checkout${inr(d.value)}`;
    case "field":
      return `Filled ${fieldLabel(String(d.f))}`;
    case "checkout_error":
      return `Form problem: ${fieldList(d.fields)}`;
    case "pay_click":
      return `Tapped Pay${inr(d.total)}`;
    case "signin_error":
      return "Couldn't sign in";
    case "order_error":
      return `Order refused: ${d.msg ?? d.code ?? ""}`;
    case "order_created":
      return "Payment window opened";
    case "payment_closed":
      return "Closed the payment window";
    case "payment_error":
      return "Payment window didn't open";
    case "payment_failed":
      return "Payment failed";
    case "payment_not_done":
    case "order_unpaid":
      return "Order not paid";
    case "pay_again":
      return "Tried paying again";
    case "paid":
      return `Paid${inr(d.total)}`;
    default:
      return ev.e.replace(/_/g, " ");
  }
}

export type Tone = "good" | "bad" | "cart" | "plain";
export function eventTone(e: string): Tone {
  if (e === "paid") return "good";
  if (/error|failed|closed|not_done|unpaid/.test(e)) return "bad";
  if (e === "add_to_cart" || e === "checkout" || e === "pay_click" || e === "order_created" || e === "pay_again") return "cart";
  return "plain";
}

/** Where the guest stopped, from their latest steps. */
function whereLeft(sessions: JourneySession[], paid: boolean): { leftAt: string; stage: Visitor["stage"] } {
  if (paid) return { leftAt: "Bought", stage: "paid" };
  const evs = sessions.flatMap((s) => s.events).sort((a, b) => a.t - b.t);
  const last = (names: string[]) => [...evs].reverse().find((e) => names.includes(e.e));
  const lastPath = sessions[0]?.last_path;
  const pay = last(["payment_failed", "payment_closed", "payment_not_done", "order_unpaid", "payment_error", "order_error", "order_created"]);
  if (pay) {
    const words: Record<string, string> = {
      payment_failed: "Payment failed",
      payment_closed: "Closed the payment window",
      payment_not_done: "Payment window · didn't pay",
      order_unpaid: "Payment window · didn't pay",
      payment_error: "Payment window didn't open",
      order_error: "Order refused at checkout",
      order_created: "Payment window · didn't pay",
    };
    return { leftAt: words[pay.e], stage: "payment" };
  }
  const checkoutSteps = evs.filter((e) => ["checkout", "field", "checkout_error", "pay_click"].includes(e.e));
  if (checkoutSteps.length) {
    const end = checkoutSteps[checkoutSteps.length - 1];
    const fields = [...new Set(checkoutSteps.filter((e) => e.e === "field").map((e) => fieldLabel(String(e.d?.f))))];
    let step: string;
    if (end.e === "checkout_error") step = `form problem: ${fieldList(end.d?.fields)}`;
    else if (end.e === "pay_click") step = "tapped Pay";
    else if (fields.length === 0) step = "didn't start the form";
    else if (fields.some((f) => ["PIN code", "house / street", "city"].includes(f))) step = "address step";
    else step = "contact details step";
    return { leftAt: `Checkout (${step})`, stage: "checkout" };
  }
  const added = evs.some((e) => e.e === "add_to_cart");
  return { leftAt: lastPath ? pageName(lastPath) : "—", stage: added ? "cart" : "browsing" };
}

export function groupVisitors(sessions: JourneySession[]): Visitor[] {
  const by = new Map<string, JourneySession[]>();
  for (const s of sessions) {
    const list = by.get(s.visitor_id) ?? [];
    list.push(s);
    by.set(s.visitor_id, list);
  }
  return [...by.entries()].map(([id, list]) => {
    list.sort((a, b) => b.last_at.localeCompare(a.last_at));
    const first = list[list.length - 1];
    const paid = list.some((s) => s.paid);
    const withCart = list.find((s) => s.cart_items && s.cart_items.length);
    const latest = <K extends keyof JourneySession>(k: K) => list.find((s) => s[k])?.[k] ?? null;
    return {
      id,
      sessions: list,
      visits: Math.max(...list.map((s) => s.visits)),
      firstAt: list.reduce((min, s) => (s.first_at < min ? s.first_at : min), first.first_at),
      lastAt: list[0].last_at,
      totalMs: list.reduce((sum, s) => sum + sessionMs(s), 0),
      pageCount: list.reduce((sum, s) => sum + s.pages.length, 0),
      added: list.some((s) => s.added_to_cart),
      checkout: list.some((s) => s.opened_checkout),
      payClicked: list.some((s) => s.pay_clicked),
      paid,
      orderId: (latest("order_id") as string | null) ?? null,
      name: latest("contact_name") as string | null,
      email: latest("contact_email") as string | null,
      phone: latest("contact_phone") as string | null,
      cart: paid ? null : (withCart?.cart_items ?? null),
      cartValue: paid ? null : (withCart?.cart_value ?? null),
      addedCount: list.flatMap((s) => s.events).filter((e) => e.e === "add_to_cart").length,
      addedItems: list
        .flatMap((s) => s.events)
        .filter((e) => e.e === "add_to_cart")
        .sort((a, b) => a.t - b.t)
        .map((e) => ({ name: String(e.d?.name ?? "Item"), price: typeof e.d?.price === "number" ? e.d.price : null })),
      // the latest visit that came from somewhere (an ad beats "directly")
      source: sourceLabel(list.find((s) => s.source && s.source !== "direct") ?? list[0]),
      device: deviceLabel(latest("device") as string | null),
      place: latest("place") as string | null,
      first,
      ...whereLeft(list, paid),
    };
  });
}

/** A visit's steps in order: pages with their time, and what happened on them. */
export type Step =
  | { kind: "page"; t: number; name: string; path: string; ms: number }
  | { kind: "event"; t: number; label: string; tone: Tone; e: string };

export function visitSteps(s: JourneySession): Step[] {
  const raw: Step[] = [
    ...s.pages.map((p) => ({ kind: "page" as const, t: p.t, name: pageName(p.p), path: p.p, ms: p.ms })),
    ...s.events
      .filter((e) => e.e !== "checkout") // the Checkout page itself says it
      .map((e) => ({ kind: "event" as const, t: e.t, label: eventLabel(e), tone: eventTone(e.e), e: e.e })),
  ].sort((a, b) => a.t - b.t);
  // A reload or the same page twice in a row is one step; filled fields in a row are one step.
  const out: Step[] = [];
  for (const [n, step] of raw.entries()) {
    // a page opened in the background and never looked at (not the last one) adds nothing
    if (step.kind === "page" && step.ms < 1000 && n < raw.length - 1) continue;
    const prev = out[out.length - 1];
    if (step.kind === "page" && prev?.kind === "page" && prev.path === step.path) {
      prev.ms += step.ms;
      continue;
    }
    if (step.kind === "event" && step.e === "field" && prev?.kind === "event" && prev.e === "field") {
      prev.label += `, ${step.label.replace(/^Filled /, "")}`;
      continue;
    }
    out.push({ ...step });
  }
  return out;
}
