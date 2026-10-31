"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Bell,
  BellOff,
  BellRing,
  ImageUp,
  ShoppingCart,
  X,
} from "lucide-react";

/**
 * New-order alerts for the whole admin panel. The moment an order is paid:
 * a pop-up with what to prepare (and an Open button), a chime, a desktop
 * notification when the tab is in the background, "(2)" in the tab title and a
 * red count on Orders. Live via Supabase Realtime; the API is only polled as a
 * backup while that live feed is down (every 60 s, backing off up to 10 min
 * while the server can't be reached), plus one check when the tab comes back
 * into view or the network returns.
 */

export type AlertOrder = {
  id: string;
  code: string;
  total: number;
  paidAt: string;
  customer: string;
  place: string;
  stickers: number;
  lines: number;
  designsMissing: number;
  customLines: number;
};

type Ctx = {
  /** Paid orders waiting to be packed. */
  count: number;
  /** Alerts are on (sound + desktop notifications allowed by the browser). */
  enabled: boolean;
  enable: () => void;
  mute: () => void;
};

const OrderAlertsContext = createContext<Ctx>({
  count: 0,
  enabled: false,
  enable: () => {},
  mute: () => {},
});
export const useOrderAlerts = () => useContext(OrderAlertsContext);

const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 10 * 60_000;
/** Realtime bursts (several order updates at once) become one check. */
const LIVE_DEBOUNCE_MS = 1_500;
/** Ignore focus / online nudges this soon after the last check. */
const MIN_GAP_MS = 10_000;
const LAST_SEEN_KEY = "sp_admin_orders_seen_at";
const SOUND_KEY = "sp_admin_order_sound";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function OrderAlertsProvider({
  supabaseUrl,
  supabaseAnonKey,
  children,
}: {
  /** Absent in demo mode — then it only polls. */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [popups, setPopups] = useState<AlertOrder[]>([]);
  const [enabled, setEnabled] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const inFlight = useRef(false);
  const lastCheck = useRef(0);
  const failures = useRef(0);
  /** Realtime channel is connected — no need to poll. */
  const live = useRef(false);

  // Sound + desktop notifications need one click to allow (browser rule).
  useEffect(() => {
    const perm =
      typeof Notification !== "undefined" ? Notification.permission : "denied";
    setEnabled(
      read(SOUND_KEY) !== "off" &&
        (perm === "granted" || read(SOUND_KEY) === "on"),
    );
  }, []);

  const chime = useCallback(() => {
    if (read(SOUND_KEY) === "off") return;
    try {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      void ctx.resume();
      // A bright two-note "ding-ding", played twice.
      const notes = [880, 1318.5, 880, 1318.5];
      notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.16 + (i > 1 ? 0.25 : 0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {}
  }, []);

  const announce = useCallback(
    (fresh: AlertOrder[]) => {
      if (!fresh.length) return;
      setPopups((prev) => [...fresh, ...prev].slice(0, 4));
      chime();
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        for (const o of fresh.slice(0, 3)) {
          const n = new Notification(`New order ${o.code} · ${inr(o.total)}`, {
            body: `${o.customer}${o.place ? `, ${o.place}` : ""} — ${o.stickers} sticker${o.stickers === 1 ? "" : "s"}${
              o.designsMissing
                ? ` · ${o.designsMissing} design${o.designsMissing === 1 ? "" : "s"} still to upload`
                : ""
            }`,
            icon: "/icons/icon-192.png",
            tag: `order-${o.id}`,
          });
          n.onclick = () => {
            window.focus();
            router.push(`/orders/${o.id}`);
            n.close();
          };
        }
      }
      // Keep the orders list itself current.
      if (pathRef.current.startsWith("/orders") || pathRef.current === "/")
        router.refresh();
    },
    [chime, router],
  );

  /** Returns false when the server couldn't be reached (used for backoff). */
  const check = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return true;
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      return false;
    inFlight.current = true;
    lastCheck.current = Date.now();
    let orders: AlertOrder[];
    try {
      const res = await fetch("/api/orders/alerts", { cache: "no-store" });
      if (!res.ok) {
        failures.current++;
        return false;
      }
      orders = (await res.json()).orders as AlertOrder[];
    } catch {
      failures.current++;
      return false;
    } finally {
      inFlight.current = false;
    }
    failures.current = 0;
    setCount(orders.length);
    if (known.current === null) {
      // First look: everything already paid is "known". Orders paid since the
      // admin last had the panel open get one grouped alert.
      known.current = new Set(orders.map((o) => o.id));
      const since = Number(read(LAST_SEEN_KEY) ?? 0);
      if (since) announce(orders.filter((o) => Date.parse(o.paidAt) > since));
    } else {
      const fresh = orders.filter((o) => !known.current!.has(o.id));
      fresh.forEach((o) => known.current!.add(o.id));
      announce(fresh);
    }
    write(LAST_SEEN_KEY, String(Date.now()));
    return true;
  }, [announce]);

  // Backup polling: only while the live feed is down, slowing down (up to
  // 10 min) while the server can't be reached. Plus one check when the tab
  // comes back into view or the network returns.
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped) return;
      const wait = Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS);
      timer = window.setTimeout(tick, wait);
    };
    const tick = async () => {
      if (!live.current) await check();
      schedule();
    };
    const nudge = () => {
      if (Date.now() - lastCheck.current < MIN_GAP_MS) return;
      failures.current = 0;
      void check().then(schedule);
    };
    const onVisible = () => document.visibilityState === "visible" && nudge();
    void check().then(schedule);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", nudge);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", nudge);
    };
  }, [check]);

  // Live: any order turning "paid" triggers a check straight away.
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    let debounce = 0;
    const checkSoon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void check(), LIVE_DEBOUNCE_MS);
    };
    // Order rows are admin-only (row-level security), so the live channel must
    // carry the admin's login — load it before subscribing, or nothing arrives.
    void supabase.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel("admin-new-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            const row = payload.new as { status?: string } | undefined;
            if (
              row?.status === "paid" ||
              (payload.old as { status?: string } | undefined)?.status ===
                "paid"
            ) {
              checkSoon();
            }
          },
        )
        .subscribe((status) => {
          const wasLive = live.current;
          live.current = status === "SUBSCRIBED";
          // Reconnected after a drop: catch up on anything missed meanwhile.
          if (live.current && !wasLive && lastCheck.current) checkSoon();
        });
    });
    // Keep the live channel's login fresh when the session token renews.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });
    return () => {
      stopped = true;
      live.current = false;
      window.clearTimeout(debounce);
      sub.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabaseUrl, supabaseAnonKey, check]);

  // "(2) Orders · StickyPie Admin" in the tab while orders wait.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\)\s*/, "");
      const next = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // Next.js resets the title on navigation and refresh (and fights an
    // observer that re-prefixes it), so just re-apply it once a second.
    const timer = window.setInterval(apply, 1000);
    return () => window.clearInterval(timer);
  }, [count, pathname]);

  const enable = useCallback(() => {
    write(SOUND_KEY, "on");
    setEnabled(true);
    try {
      audio.current = audio.current ?? new AudioContext();
      void audio.current.resume();
    } catch {}
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    chime();
  }, [chime]);

  const mute = useCallback(() => {
    write(SOUND_KEY, "off");
    setEnabled(false);
  }, []);

  const dismiss = (id: string) =>
    setPopups((p) => p.filter((o) => o.id !== id));

  return (
    <OrderAlertsContext.Provider value={{ count, enabled, enable, mute }}>
      {children}
      {/* New-order pop-ups: stay until dismissed or opened */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[110] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2.5">
        {popups.map((o) => (
          <div
            key={o.id}
            role="alert"
            className="animate-toast-in pointer-events-auto overflow-hidden rounded-2xl border border-mint/40 bg-ink2 shadow-2xl"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-xl bg-mint/15 text-mint">
                <ShoppingCart className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold tracking-widest text-mint uppercase">
                  New paid order
                </p>
                <p className="mt-0.5 font-semibold">
                  {o.code} · {inr(o.total)}
                </p>
                <p className="mt-0.5 truncate text-xs text-fog">
                  {o.customer}
                  {o.place ? ` · ${o.place}` : ""}
                </p>
                <p className="mt-1 text-xs text-fog">
                  {o.stickers} sticker{o.stickers === 1 ? "" : "s"} · {o.lines}{" "}
                  line{o.lines === 1 ? "" : "s"}
                  {o.customLines > 0 && ` · ${o.customLines} custom`}
                </p>
                {o.designsMissing > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                    <ImageUp className="size-3" /> {o.designsMissing} design
                    {o.designsMissing === 1 ? "" : "s"} not uploaded yet
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(o.id)}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-fog hover:bg-white/5 hover:text-snow"
              >
                <X className="size-4" />
              </button>
            </div>
            <Link
              href={`/orders/${o.id}`}
              onClick={() => dismiss(o.id)}
              className="block border-t border-line bg-mint/10 px-4 py-2.5 text-center text-sm font-semibold text-mint hover:bg-mint/15"
            >
              Open order →
            </Link>
          </div>
        ))}
      </div>
    </OrderAlertsContext.Provider>
  );
}

/** Bell button: turn alerts on (one click — browsers require it) or mute them. */
export function OrderAlertsToggle({ className = "" }: { className?: string }) {
  const { enabled, enable, mute } = useOrderAlerts();
  // Read after mount: the server can't know the browser's permission.
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    setDenied(typeof Notification !== "undefined" && Notification.permission === "denied");
  }, [enabled]);
  return enabled ? (
    <button
      type="button"
      onClick={mute}
      title="New-order alerts are on — click to mute"
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-mint hover:bg-white/5 ${className}`}
    >
      <BellRing className="size-4" /> Order alerts on
    </button>
  ) : (
    <button
      type="button"
      onClick={enable}
      title="Get a sound and a desktop notification for every new order"
      className={`inline-flex animate-pulse items-center gap-2 rounded-xl bg-gold/15 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20 ${className}`}
    >
      {denied ? (
        <BellOff className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      Turn on order alerts
    </button>
  );
}
