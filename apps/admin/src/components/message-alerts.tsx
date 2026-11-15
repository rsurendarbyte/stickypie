"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { MessageCircle, X } from "lucide-react";
import type { ContactMessage } from "@stickypie/shared";

/**
 * Live contact messages for the whole admin panel: a red count on Messages
 * (shoppers waiting for a reply), and the moment a new message or a shopper's
 * answer lands, a pop-up with a soft chime (desktop notification when the tab
 * is in the background). Live via Supabase Realtime, with a slow backup check
 * while the live feed is down and when the tab comes back into view.
 * The Messages page listens to MESSAGES_EVENT to update its list in place.
 */

export const MESSAGES_EVENT = "sp-admin-messages";
type Ctx = { count: number; messages: ContactMessage[] | null; reload: () => void };
const MessageAlertsContext = createContext<Ctx>({ count: 0, messages: null, reload: () => {} });
export const useMessageAlerts = () => useContext(MessageAlertsContext);

const POLL_MS = 90_000;
const LIVE_DEBOUNCE_MS = 800;
const SOUND_KEY = "sp_admin_order_sound";

type Popup = { key: string; name: string; text: string };

/** Shoppers (by email) with a conversation that needs our reply. */
function waitingCount(list: ContactMessage[]): number {
  return new Set(list.filter((m) => m.status === "new").map((m) => m.email.toLowerCase())).size;
}

/** Every shopper-written item: original messages and their answers. */
function shopperItems(list: ContactMessage[]): Map<string, Popup> {
  const out = new Map<string, Popup>();
  for (const m of list) {
    out.set(m.id, { key: m.id, name: m.name, text: m.message });
    for (const r of m.replies) if (r.author === "customer") out.set(r.id, { key: r.id, name: m.name, text: r.body });
  }
  return out;
}

export function MessageAlertsProvider({
  supabaseUrl,
  supabaseAnonKey,
  children,
}: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const known = useRef<Set<string> | null>(null);
  const live = useRef(false);
  const inFlight = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const chime = useCallback(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === "off") return;
    } catch {}
    try {
      const ctx = new AudioContext();
      [660, 990].forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
      window.setTimeout(() => void ctx.close(), 800);
    } catch {}
  }, []);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) return;
      const list = (await res.json()).messages as ContactMessage[];
      setMessages(list);
      window.dispatchEvent(new CustomEvent(MESSAGES_EVENT, { detail: list }));
      const items = shopperItems(list);
      if (known.current === null) {
        known.current = new Set(items.keys());
        return;
      }
      const fresh = [...items.values()].filter((p) => !known.current!.has(p.key));
      fresh.forEach((p) => known.current!.add(p.key));
      if (!fresh.length) return;
      chime();
      if (!pathRef.current.startsWith("/messages")) setPopups((prev) => [...fresh, ...prev].slice(0, 3));
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        for (const p of fresh.slice(0, 2)) {
          const n = new Notification(`Message from ${p.name}`, { body: p.text.slice(0, 140), icon: "/icons/icon-192.png", tag: `msg-${p.key}` });
          n.onclick = () => {
            window.focus();
            window.location.href = "/messages";
            n.close();
          };
        }
      }
    } catch {
    } finally {
      inFlight.current = false;
    }
  }, [chime]);

  // First load + backup checks while live is down + when the tab comes back.
  useEffect(() => {
    void check();
    const timer = window.setInterval(() => !live.current && void check(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Live: any change to messages or replies (rows are admin-only under RLS,
  // so the channel carries the admin's login).
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    let debounce = 0;
    const soon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void check(), LIVE_DEBOUNCE_MS);
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel("admin-contact-messages")
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, soon)
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_replies" }, soon)
        .subscribe((status) => {
          const was = live.current;
          live.current = status === "SUBSCRIBED";
          if (live.current && !was) soon();
        });
    });
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

  const dismiss = (key: string) => setPopups((p) => p.filter((x) => x.key !== key));
  const count = messages ? waitingCount(messages) : 0;

  return (
    <MessageAlertsContext.Provider value={{ count, messages, reload: () => void check() }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[110] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 lg:left-64">
        {popups.map((p) => (
          <div
            key={p.key}
            role="alert"
            className="animate-toast-in pointer-events-auto overflow-hidden rounded-2xl border border-brand/40 bg-ink2 shadow-2xl"
          >
            <div className="flex items-start gap-3 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                <MessageCircle className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold tracking-widest text-brand uppercase">New message</p>
                <p className="mt-0.5 truncate text-sm font-semibold">{p.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-fog">{p.text}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(p.key)}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-fog hover:bg-white/5 hover:text-snow"
              >
                <X className="size-4" />
              </button>
            </div>
            <Link
              href="/messages"
              onClick={() => setPopups([])}
              className="block border-t border-line bg-brand/10 px-4 py-2 text-center text-sm font-semibold text-brand hover:bg-brand/15"
            >
              Open Messages →
            </Link>
          </div>
        ))}
      </div>
    </MessageAlertsContext.Provider>
  );
}
