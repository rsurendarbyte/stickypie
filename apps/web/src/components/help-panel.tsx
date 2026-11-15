"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, MessageCircle, Plus, Send, X } from "lucide-react";
import { SUPPORT_EMAIL, type ContactTopic } from "@stickypie/shared";
import { useShopper } from "@/lib/shopper-auth";
import { loadMe, rememberThread, saveMe } from "@/lib/contact-local";
import {
  markThreadSeen,
  onThreadChanged,
  refreshThreads,
  useContactThreads,
  type ThreadRow,
} from "@/lib/contact-live";
import { ThreadRows } from "./contact-threads";

type Thread = {
  id: string;
  topic: string;
  orderCode: string | null;
  status: "new" | "replied" | "resolved";
  message: string;
  createdAt: string;
  replies: { id: string; author: "admin" | "customer"; body: string; createdAt: string }[];
};

type View = { name: "home" } | { name: "new" } | { name: "chat"; id: string; path: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const inputCls =
  "w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-[16px] text-snow outline-none placeholder:text-fog/70 focus:border-[var(--chat)]/60 sm:text-sm";

/** The help bubble's panel: conversations, one conversation as a chat, or a new message. */
export default function HelpPanel({ startOn, onClose }: { startOn: string | null; onClose: () => void }) {
  const { threads, seen, ready } = useContactThreads();
  const [view, setView] = useState<View>({ name: "home" });

  // Opened from the header bell / a reply peek: straight into that chat.
  useEffect(() => {
    if (!startOn) return;
    const t = threads.find((x) => x.id === startOn);
    if (t) setView({ name: "chat", id: t.id, path: t.path });
  }, [startOn, threads]);

  // No conversations yet: go straight to the form.
  useEffect(() => {
    if (ready && !threads.length && view.name === "home") setView({ name: "new" });
  }, [ready, threads.length, view.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (t: ThreadRow) => setView({ name: "chat", id: t.id, path: t.path });

  return (
    <div
      role="dialog"
      aria-label="Help and messages"
      className="fixed inset-x-2 top-[max(4.5rem,env(safe-area-inset-top))] help-panel-dock z-[80] flex flex-col overflow-hidden rounded-3xl border border-line bg-ink shadow-2xl sm:inset-x-auto sm:top-auto sm:right-5 sm:h-[min(600px,calc(100vh-12.5rem))] lg:h-[min(600px,calc(100vh-8rem))] sm:w-[380px]"
    >
      <header className="chat-gradient flex items-center gap-2 px-4 py-3 text-white">
        {view.name !== "home" && threads.length > 0 && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setView({ name: "home" })}
            className="-ml-1 grid size-8 place-items-center rounded-full hover:bg-white/15"
          >
            <ArrowLeft className="size-4.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-tight font-bold">
            {view.name === "new" ? "StickyPie helper" : view.name === "chat" ? "Your conversation" : "Help & messages"}
          </p>
          <p className="text-[11.5px] text-white/85">We reply in 1–2 days, here and by email</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-white/15">
          <X className="size-4.5" />
        </button>
      </header>

      {view.name === "home" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => setView({ name: "new" })}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--chat)]/30 bg-[var(--chat)]/5 px-3.5 py-3 text-left hover:bg-[var(--chat)]/10"
          >
            <span className="chat-gradient grid size-9 shrink-0 place-items-center rounded-full text-white">
              <Plus className="size-4.5" />
            </span>
            <span>
              <span className="block text-sm font-bold">New message</span>
              <span className="block text-xs text-fog">Bulk, custom stickers or order help</span>
            </span>
          </button>
          {threads.length > 0 && (
            <>
              <p className="mt-4 mb-2 px-1 text-[11px] font-bold tracking-widest text-fog uppercase">Your conversations</p>
              <ThreadRows threads={threads} seen={seen} onOpen={open} />
            </>
          )}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fog hover:text-brand"
          >
            <Mail className="size-3.5" /> Or email {SUPPORT_EMAIL}
          </a>
        </div>
      )}

      {view.name === "new" && <Assistant onSent={(id, path) => setView({ name: "chat", id, path })} />}
      {view.name === "chat" && <Chat key={view.id} id={view.id} path={view.path} />}
    </div>
  );
}

/** Quick-reply topics the helper offers first. */
const STARTERS: { label: string; topic: ContactTopic; answer: string; ask: string; link?: { label: string; href: string } }[] = [
  {
    label: "Track my order",
    topic: "order",
    answer:
      "Live tracking is on your order page: open the link in your order email, or My orders if you're signed in.",
    ask: "Need more help with it? Tell me your order number (it looks like SP-XXXXXXXX) and what happened.",
    link: { label: "My orders", href: "/account" },
  },
  {
    label: "Custom stickers",
    topic: "custom",
    answer: "We print your own picture, text or logo as die-cut vinyl stickers in 3″, 6″ or 7″.",
    ask: "What should we print, which size, how many, and when do you need them?",
    link: { label: "Design it yourself", href: "/custom-stickers/design" },
  },
  {
    label: "Bulk / business order",
    topic: "bulk",
    answer: "Happy to help with bulk orders for shops, events, colleges and brands.",
    ask: "Tell me the design or theme, size, quantity, needed-by date and delivery city.",
  },
  {
    label: "Delivery & shipping",
    topic: "order",
    answer: "Shipping depends on your area and shows in your cart before you pay.",
    ask: "Need it by a certain date? Tell me your city or PIN code and the date, and our team will confirm.",
  },
  {
    label: "Something else",
    topic: "general",
    answer: "Sure!",
    ask: "Tell me what you need and our team will take it from here.",
  },
];

type Line = { id: number; from: "bot" | "me"; text: string; link?: { label: string; href: string } };
type Step = "topic" | "message" | "confirmMe" | "name" | "phone" | "email" | "sending" | "done";

let lineId = 0;
const PHONE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The help bubble's guided chat: feels like an assistant (greeting, quick
 * replies, instant answers to common questions, details asked one at a time),
 * then hands the conversation to the StickyPie team in the admin's Messages.
 * No AI: fixed answers only, so it never promises dates, prices or discounts.
 */
function Assistant({ onSent }: { onSent: (id: string, path: string) => void }) {
  const shopper = useShopper();
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<Step>("topic");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const data = useRef({ topic: "general" as ContactTopic, message: "", name: "", phone: "", email: "" });
  const known = useRef(loadMe());
  const end = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  /** Bot lines appear one by one after a short "typing…" pause. */
  const say = useCallback((texts: (string | Omit<Line, "id" | "from">)[], then?: () => void) => {
    let wait = 0;
    texts.forEach((t, i) => {
      wait += 450 + Math.min(700, (typeof t === "string" ? t : t.text).length * 8);
      timers.current.push(
        window.setTimeout(() => {
          setTyping(i < texts.length - 1);
          const line = typeof t === "string" ? { text: t } : t;
          setLines((l) => [...l, { id: ++lineId, from: "bot", ...line }]);
          if (i === texts.length - 1) then?.();
        }, wait)
      );
    });
    setTyping(true);
  }, []);

  const me = (text: string) => setLines((l) => [...l, { id: ++lineId, from: "me", text }]);

  useEffect(() => {
    say(["Hi! I'm the StickyPie helper.", "What can I help you with today?"]);
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, [say]);

  useEffect(() => {
    void end.current?.scrollIntoView({ block: "end" });
  }, [lines.length, typing, step]);

  // After each question the box is ready to type in (not on the first
  // screen: the phone keyboard would cover the quick replies).
  useEffect(() => {
    if (typing || !["message", "name", "phone", "email"].includes(step)) return;
    field.current?.focus({ preventScroll: true });
  }, [step, typing]);

  function pickTopic(s: (typeof STARTERS)[number]) {
    data.current.topic = s.topic;
    me(s.label);
    setStep("message");
    say([s.link ? { text: s.answer, link: s.link } : s.answer, s.ask]);
  }

  function askDetails() {
    const k = known.current;
    const email = shopper.email || k?.email || "";
    if (k?.name && k.phone && email) {
      data.current = { ...data.current, name: k.name, phone: k.phone, email };
      setStep("confirmMe");
      say([`Thanks! Shall our team reply to ${k.name} at ${email} (mobile ${k.phone})?`]);
    } else {
      setStep("name");
      say(["Thanks! Our team will take it from here.", "What's your name?"]);
    }
  }

  async function send() {
    setStep("sending");
    setTyping(true);
    const d = data.current;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name, phone: d.phone, email: d.email, topic: d.topic, message: d.message, orderCode: null }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof out.error === "string" ? out.error : "Couldn't send your message.");
      saveMe({ name: d.name, phone: d.phone, email: d.email });
      const path = typeof out.thread === "string" ? out.thread : null;
      setTyping(false);
      setStep("done");
      say(["Done! I've passed this to the StickyPie team.", "They'll reply right here, and by email too. Usually within 1–2 business days."], () => {
        if (!path) return;
        rememberThread(path);
        void refreshThreads();
        timers.current.push(
          window.setTimeout(() => onSent(path.match(/\/contact\/t\/([0-9a-f-]{36})/i)?.[1] ?? "", path), 1600)
        );
      });
    } catch (err) {
      setTyping(false);
      setStep("email");
      setError(err instanceof Error && !/fetch/i.test(err.message) ? err.message : "Couldn't reach StickyPie. Check your connection and tap send again.");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setError(null);
    if (step === "topic") {
      // typed instead of tapping a button: treat it as the message
      data.current.topic = "general";
      data.current.message = text;
      me(text);
      setInput("");
      askDetails();
      return;
    }
    if (step === "message") {
      if (text.length < 10) return setError("Tell us a little more (at least 10 characters).");
      data.current.message = data.current.message ? `${data.current.message}\n\n${text}` : text;
      me(text);
      setInput("");
      askDetails();
      return;
    }
    if (step === "name") {
      if (text.length < 2) return setError("Please enter your name.");
      data.current.name = text.slice(0, 80);
      me(text);
      setInput("");
      setStep("phone");
      say([`Nice to meet you, ${text.split(/\s+/)[0]}!`, "Your 10-digit mobile number? (for WhatsApp updates)"]);
      return;
    }
    if (step === "phone") {
      const digits = text.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      if (!PHONE.test(digits)) return setError("That doesn't look like a 10-digit mobile number.");
      data.current.phone = digits;
      me(digits);
      setInput("");
      const email = shopper.email || known.current?.email;
      if (email) {
        data.current.email = email;
        void send();
      } else {
        setStep("email");
        say(["And your email? We'll send our replies there too."]);
      }
      return;
    }
    if (step === "email") {
      if (!EMAIL.test(text)) return setError("Please enter a valid email.");
      data.current.email = text.toLowerCase();
      me(text);
      setInput("");
      void send();
    }
  }

  const placeholder =
    step === "topic"
      ? "Or type your question…"
      : step === "name"
        ? "Your name"
        : step === "phone"
          ? "10-digit mobile"
          : step === "email"
            ? "you@example.com"
            : "Type your message…";
  const inputOn = ["topic", "message", "name", "phone", "email"].includes(step);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {lines.map((l) =>
          l.from === "bot" ? (
            <div key={l.id} className="flex items-end gap-2">
              <span className="chat-gradient grid size-7 shrink-0 place-items-center rounded-full text-white">
                <MessageCircle className="size-3.5" />
              </span>
              <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-line bg-ink2 px-3 py-2 text-sm leading-relaxed">
                {l.text}
                {l.link && (
                  <a href={l.link.href} className="mt-1 block text-xs font-bold text-[var(--chat-ink)] hover:underline">
                    {l.link.label} →
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div key={l.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--chat)]/10 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
                {l.text}
              </div>
            </div>
          )
        )}
        {typing && (
          <div className="flex items-end gap-2" aria-label="StickyPie helper is typing">
            <span className="chat-gradient grid size-7 shrink-0 place-items-center rounded-full text-white">
              <MessageCircle className="size-3.5" />
            </span>
            <div className="rounded-2xl rounded-bl-md border border-line bg-ink2 px-3 py-2.5 text-xs font-semibold tracking-[0.3em] text-fog">
              •••
            </div>
          </div>
        )}
        {step === "topic" && !typing && lines.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5 pt-1">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pickTopic(s)}
                className="rounded-full border border-[var(--chat)]/40 bg-[var(--chat)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--chat-ink)] hover:bg-[var(--chat)]/10"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {step === "confirmMe" && !typing && (
          <div className="flex flex-wrap justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                me("Yes, that's me");
                void send();
              }}
              className="rounded-full border border-[var(--chat)]/40 bg-[var(--chat)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--chat-ink)] hover:bg-[var(--chat)]/10"
            >
              Yes, that&apos;s me
            </button>
            <button
              type="button"
              onClick={() => {
                me("Change details");
                known.current = null;
                setStep("name");
                say(["No problem. What's your name?"]);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow"
            >
              Change details
            </button>
          </div>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="border-t border-line p-2.5">
        {error && <p className="mb-1.5 px-1 text-xs text-brand">{error}</p>}
        <div className="flex items-end gap-2">
          {step === "message" || step === "topic" ? (
            <textarea
              ref={(el) => {
                field.current = el;
              }}
              aria-label="Your message"
              value={input}
              disabled={!inputOn}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={step === "message" ? 2 : 1}
              maxLength={2000}
              placeholder={placeholder}
              className={`${inputCls} max-h-28 min-h-11 resize-none`}
            />
          ) : (
            <input
              ref={(el) => {
                field.current = el;
              }}
              aria-label={placeholder}
              value={input}
              disabled={!inputOn}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              type={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
              inputMode={step === "phone" ? "numeric" : step === "email" ? "email" : "text"}
              autoComplete={step === "name" ? "name" : step === "phone" ? "tel-national" : step === "email" ? "email" : "off"}
              placeholder={inputOn ? placeholder : ""}
              className={`${inputCls} min-h-11`}
            />
          )}
          <button
            type="submit"
            aria-label="Send"
            disabled={!inputOn || typing || !input.trim()}
            className="chat-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Chat({ id, path }: { id: string; path: string }) {
  const key = path.match(/[?&]k=([0-9a-f]+)/i)?.[1] ?? "";
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contact/t/${id}?k=${key}`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data?.thread) return setFailed(true);
    const t = data.thread as Thread;
    setThread(t);
    markThreadSeen(t.id, t.replies.at(-1)?.createdAt ?? t.createdAt);
  }, [id, key]);

  useEffect(() => {
    void load();
    return onThreadChanged((changed) => {
      if (changed === id) void load();
    });
  }, [id, load]);

  useEffect(() => {
    // (Chrome's scrollIntoView returns a promise now: keep it out of the effect's return)
    void end.current?.scrollIntoView({ block: "end" });
  }, [thread?.replies.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/contact/t/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: key, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't send your message.");
      setBody("");
      await load();
      void refreshThreads();
    } catch (err) {
      setError(err instanceof Error && !/fetch/i.test(err.message) ? err.message : "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (failed) return <p className="p-6 text-center text-sm text-fog">This conversation couldn&apos;t be opened.</p>;
  if (!thread) return <p className="p-6 text-center text-sm text-fog">Loading…</p>;

  const bubbles = [{ id: thread.id, author: "customer" as const, body: thread.message, createdAt: thread.createdAt }, ...thread.replies];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        <p className="text-center text-[11px] text-fog">
          {thread.topic}
          {thread.orderCode ? ` · ${thread.orderCode}` : ""}
        </p>
        {bubbles.map((b) => {
          const ours = b.author === "admin";
          return (
            <div key={b.id} className={`flex ${ours ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  ours ? "rounded-tl-md border border-line bg-ink2" : "rounded-tr-md bg-[var(--chat)]/10"
                }`}
              >
                <p className="whitespace-pre-line select-text">{b.body}</p>
                <p className="mt-1 text-[10.5px] text-fog">
                  {ours ? "StickyPie team · " : ""}
                  {when(b.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {thread.status === "resolved" && (
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-fog">
            <CheckCircle2 className="size-3.5 text-mint" /> Marked as sorted. Write again any time.
          </p>
        )}
        {thread.status === "new" && thread.replies.every((r) => r.author === "customer") && (
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-fog">
            <MessageCircle className="size-3.5" /> Passed to the StickyPie team. They&apos;ll reply here and by email.
          </p>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="border-t border-line p-2.5">
        {error && <p className="mb-1.5 px-1 text-xs text-brand">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Your message"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
            rows={1}
            maxLength={2000}
            placeholder="Write a message…"
            className={`${inputCls} max-h-28 min-h-11 resize-none`}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={sending || !body.trim()}
            className="chat-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
