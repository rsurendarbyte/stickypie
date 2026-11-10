"use client";

// Shopper journeys for the admin's Journeys page. Notes, per visit, each page
// (path only, with the time it was on screen) and a few key steps (add to cart,
// open cart, checkout, which checkout fields got filled, pay, paid). Kept in
// memory and sent in batches to /api/journey: when the shopper leaves or
// switches app (sendBeacon), a moment after a checkout step that matters (pay,
// order, payment result, form problem), or when a long visit has a lot waiting.
// Kept light for the free plans (Cloudflare requests, Supabase space): no timer
// sends, a quick tap-and-leave sends nothing, a hide with only a few more seconds
// on the same page is skipped, and a visit stops sending after MAX_SENDS.
// Never what anyone typed, never URL queries (?k=, ?fb=, sign-in tokens), and
// nothing for bots.
//
// Never in the shopper's way: journeyPage / journey / journeyContact only note
// the time and hand the rest to the browser's idle time (requestIdleCallback),
// so a tap on Add to cart or Pay runs first and is never held up; sends are
// fire-and-forget (sendBeacon / keepalive fetch, nothing awaited, errors
// swallowed); nothing here can throw into the shop's code.

const STATE_KEY = "stickypie.journey";
/** A visit ends after this long without the shop on screen. */
const IDLE_MS = 30 * 60_000;
/** Checkout steps that matter wait this long so steps close together go in one send. */
const KEY_STEP_WAIT = 1500;
/** A hide that would only send more time on the same page waits until this long after the last send. */
const RESEND_MS = 2 * 60_000;
/** A visit shorter than this, with no steps, isn't worth a request (a mis-tap from an ad). */
const MIN_VISIT_MS = 2000;
/** Sends a single visit may make (a safety cap, a normal visit makes 1–6). */
const MAX_SENDS = 30;
/** Batch sizes that send without waiting for the shopper to leave. */
const BATCH_PAGES = 20;
const BATCH_EVENTS = 30;

type State = { vid: string; sid: string; visit: number; last: number; next: number; cart?: string; land?: string };
type Page = { i: number; p: string; t: number; ms: number };
type Ev = { e: string; t: number; p: string; d?: Record<string, string | number | boolean | null> };

let state: State | null = null;
let current: (Page & { since: number | null }) | null = null;
const pages = new Map<number, Page>();
let events: Ev[] = [];
type Meta = {
  entry: string;
  source: string;
  campaign?: string;
  medium?: string;
  content?: string;
  ad?: boolean;
  referrer?: string;
  screen?: string;
  lang?: string;
};
type Contact = { name?: string; email?: string; phone?: string };
let meta: Meta | null = null;
let contact: Contact | null = null;
let contactSent = "";
let order: string | undefined;
let soon: ReturnType<typeof setTimeout> | undefined;
let started = false;
let sentOpen: { i: number; ms: number } | null = null;
/** This visit's sends so far, and when the last one went. */
let sends = { sid: "", n: 0, at: 0, any: false, maxI: -1 };
const onceKeys = new Set<string>();

const off = () =>
  typeof window === "undefined" ||
  navigator.webdriver ||
  /bot|crawl|spider|lighthouse|facebookexternalhit|headless/i.test(navigator.userAgent) ||
  location.pathname.startsWith("/print-job");

const uuid = () => crypto.randomUUID();

/** Notes waiting for idle time, oldest first. */
const pending: Array<() => void> = [];
let idleAsked = false;

/** Runs every waiting note now (on idle, or before a leave-send); never throws. */
function drain() {
  idleAsked = false;
  while (pending.length) {
    const fn = pending.shift()!;
    try {
      fn();
    } catch {
      // tracking must never break the shop
    }
  }
}

/** Runs `fn` when the browser is idle (within 2 s at most), after the shopper's tap is handled. */
function later(fn: () => void) {
  pending.push(fn);
  if (idleAsked) return;
  idleAsked = true;
  try {
    if (typeof requestIdleCallback === "function") requestIdleCallback(drain, { timeout: 2000 });
    else setTimeout(drain, 50);
  } catch {
    idleAsked = false;
  }
}

/** A finished page shorter than this (a fast swipe past) isn't kept. */
const MIN_PAGE_MS = 500;

function save() {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage off: the visit still counts, just not the next one
  }
}

/** Where this visit came from, in a word: "instagram link", "google", "direct"… */
function sourceName(q: URLSearchParams, host: string): string {
  const utm = q.get("utm_source")?.toLowerCase().slice(0, 30);
  const paid = /paid|cpc|ad|ppc/.test(q.get("utm_medium")?.toLowerCase() ?? "");
  if (utm) return `${utm}${paid ? " ad" : ""}`;
  const insta = /instagram/i.test(navigator.userAgent) || /instagram\./.test(host);
  const fb = /FBAN|FBAV|FB_IAB/.test(navigator.userAgent) || /facebook\.|fb\.com/.test(host);
  const fromAd = q.has("fbclid");
  if (insta) return fromAd ? "instagram link" : "instagram";
  if (fb) return fromAd ? "facebook link" : "facebook";
  if (fromAd) return "meta link";
  if (/google\./.test(host)) return q.has("gclid") ? "google ad" : "google";
  if (host) return host.replace(/^www\./, "").slice(0, 40);
  return "direct";
}

/**
 * Where this visit came from (landing link values and referrer site, never ids)
 * plus ordinary device facts: screen size and language. No fingerprinting.
 */
function sourceOf(): Omit<Meta, "entry"> {
  const q = new URLSearchParams(location.search);
  const medium = q.get("utm_medium")?.toLowerCase() ?? "";
  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname : "";
  } catch {}
  if (host === location.hostname) host = "";
  return {
    source: sourceName(q, host),
    campaign: q.get("utm_campaign")?.slice(0, 80) || undefined,
    medium: medium.slice(0, 40) || undefined,
    content: q.get("utm_content")?.slice(0, 80) || undefined,
    // fbclid / gclid = the visitor tapped an ad or a Meta/Google link; only that it was there is kept
    ad: /paid|cpc|ad|ppc/.test(medium) || q.has("fbclid") || q.has("gclid"),
    referrer: host.replace(/^www\./, "") || undefined,
    screen: `${screen.width}×${screen.height}`,
    lang: navigator.language?.slice(0, 20),
  };
}

/** The visit going on now, starting a new one after 30 idle minutes. */
function visit(now = Date.now()): State {
  let freshLink = false;
  let landing: string | undefined;
  if (!state) {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) state = JSON.parse(raw) as State;
    } catch {}
    // landing from a new ad or tagged link starts a new visit, even soon after the last one
    // (a reload of the same link doesn't: only a short hash of it is kept, on this phone)
    if (/[?&](utm_source|fbclid|gclid)=/.test(location.search)) {
      landing = hash(location.search);
      freshLink = landing !== state?.land;
    }
  }
  if (!state || !state.vid) {
    state = { vid: uuid(), sid: uuid(), visit: 1, last: now, next: 0 };
    meta = { entry: location.pathname, ...sourceOf() };
  } else if (freshLink || now - state.last > IDLE_MS) {
    state = { ...state, sid: uuid(), visit: state.visit + 1, last: now, next: 0 };
    meta = { entry: location.pathname, ...sourceOf() };
    pages.clear();
    events = [];
    onceKeys.clear();
  }
  if (landing) state.land = landing;
  state.last = now;
  save();
  return state;
}

/** A short, one-way tag for a landing link, to tell a reload from a new click. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The page on screen now, with its on-screen time so far. */
function snapshot(now = Date.now()): Page | null {
  if (!current) return null;
  const ms = current.ms + (current.since ? now - current.since : 0);
  return { i: current.i, p: current.p, t: current.t, ms: Math.round(ms) };
}

function flush(leaving = false) {
  try {
    send(leaving);
  } catch {
    // tracking must never break the shop
  }
}

function send(leaving: boolean) {
  clearTimeout(soon);
  soon = undefined;
  if (!state) return;
  // the page on screen goes along unless it was just sent (hide and pagehide both fire on leaving)
  const open = snapshot();
  if (open && !(sentOpen?.i === open.i && open.ms - sentOpen.ms < 1000)) {
    pages.set(open.i, open);
    sentOpen = { i: open.i, ms: open.ms };
  }
  if (sends.sid !== state.sid) sends = { sid: state.sid, n: 0, at: 0, any: false, maxI: -1 };
  if (!pages.size && !events.length && !contact) return;
  const steps = events.length > 0 || !!contact;
  // a quick tap-and-leave: nothing yet (kept, and sent if they stay or come back)
  if (meta && !sends.any && !steps && pages.size <= 1 && (open?.ms ?? 0) < MIN_VISIT_MS) {
    sentOpen = null;
    return;
  }
  // nothing new but a few more seconds on pages already sent, and the last send was
  // recent: skip (a new page always goes, it's where they left)
  const newPage = [...pages.keys()].some((i) => i > sends.maxI);
  if (sends.any && !steps && !newPage && Date.now() - sends.at < RESEND_MS) return;
  if (sends.n >= MAX_SENDS) {
    pages.clear();
    events = [];
    return;
  }
  if (!state.cart && events.length) {
    // the cart's id (made on the first add), to link this visit to its cart and order
    try {
      const token = localStorage.getItem("stickypie.cart.token");
      if (token) {
        state.cart = token;
        save();
      }
    } catch {}
  }
  const pageList = [...pages.values()].slice(-40);
  const body = JSON.stringify({
    sid: state.sid,
    vid: state.vid,
    visit: state.visit,
    ...(meta ?? {}),
    ...(contact ? { contact } : {}),
    ...(state.cart ? { cart: state.cart } : {}),
    ...(order ? { order } : {}),
    pages: pageList,
    events: events.slice(-40),
  });
  pages.clear();
  events = [];
  meta = null;
  contact = null;
  sends = { sid: state.sid, n: sends.n + 1, at: Date.now(), any: true, maxI: Math.max(sends.maxI, ...pageList.map((x) => x.i)) };
  try {
    if (leaving && navigator.sendBeacon?.("/api/journey", new Blob([body], { type: "text/plain" }))) return;
    void fetch("/api/journey", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch {}
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", onHideOrShow, { passive: true } as AddEventListenerOptions);
  window.addEventListener("pagehide", () => {
    drain();
    flush(true);
  });
}

function toggle() {
  const now = Date.now();
  if (document.visibilityState === "hidden") {
    drain(); // notes still waiting for idle time go in this send
    if (current?.since) {
      current.ms += now - current.since;
      current.since = null;
    }
    if (state) {
      state.last = now;
      save();
    }
    flush(true);
  } else {
    const before = state?.sid;
    const s = visit(now);
    if (current) {
      // back after a long break: this page opens the new visit
      if (s.sid !== before) {
        current = { i: s.next++, p: current.p, t: now, ms: 0, since: now };
        save();
      } else current.since = now;
    }
  }
}

function onHideOrShow() {
  try {
    toggle();
  } catch {}
}

/** A new page on screen (call on every route change). */
export function journeyPage(path: string) {
  const now = Date.now();
  const shown = typeof document !== "undefined" && document.visibilityState === "visible";
  start(); // just two listeners, so a leave right away still sends
  later(() => notePage(path, now, shown));
}

function notePage(path: string, now: number, shown: boolean) {
  if (off()) return;
  start();
  if (current?.p === path) return; // StrictMode re-run / same page / swipe and router both
  const s = visit(now);
  const done = snapshot(now);
  // a page swiped past in under half a second isn't worth keeping
  if (done && done.ms >= MIN_PAGE_MS) pages.set(done.i, done);
  current = { i: s.next++, p: path, t: now, ms: 0, since: shown ? now : null };
  save();
  if (pages.size >= BATCH_PAGES) flush();
}

/**
 * A key step. `once` keeps it to one per visit (e.g. each checkout field).
 * `now` = a step that matters (pay, order, payment result): sent a moment later,
 * together with any step right after it; the rest go when the shopper leaves.
 * Values must be short labels or numbers, never what the shopper typed.
 */
export function journey(e: string, d?: Ev["d"], opts: { once?: string; now?: boolean } = {}) {
  const t = Date.now();
  const p = typeof location === "undefined" ? "" : location.pathname;
  later(() => noteStep(e, d, opts, t, p));
}

function noteStep(e: string, d: Ev["d"] | undefined, opts: { once?: string; now?: boolean }, t: number, p: string) {
  if (off()) return;
  start();
  if (opts.once) {
    if (onceKeys.has(opts.once)) return;
    onceKeys.add(opts.once);
  }
  visit(t);
  if (typeof d?.order === "string") order = d.order;
  events.push({ e, t, p, ...(d ? { d } : {}) });
  if (opts.now) {
    if (!soon) soon = setTimeout(() => later(flush), KEY_STEP_WAIT);
  } else if (events.length >= BATCH_EVENTS) flush();
}

/**
 * The name, email and phone typed at checkout, sent once they look complete so
 * the admin can see who left without paying. Only changes are sent.
 */
export function journeyContact(c: Contact) {
  later(() => noteContact(c));
}

function noteContact(c: Contact) {
  if (off()) return;
  const name = c.name?.trim();
  const email = c.email?.trim();
  const phone = c.phone?.replace(/\D/g, "");
  const next: Contact = {
    ...(name && name.length >= 2 ? { name } : {}),
    ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? { email } : {}),
    ...(phone && /^[6-9]\d{9}$/.test(phone) ? { phone } : {}),
  };
  const key = JSON.stringify(next);
  if (key === "{}" || key === contactSent) return;
  contactSent = key;
  start();
  visit();
  contact = next;
  // goes with the next send (Pay, or leaving the page)
}
