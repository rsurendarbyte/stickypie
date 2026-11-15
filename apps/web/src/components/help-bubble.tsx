"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import ChatFace from "./chat-face";
import { HELP_OPEN_EVENT, isUnread, useContactThreads } from "@/lib/contact-live";

// The panel (form, chat) downloads on first tap only.
const HelpPanel = dynamic(() => import("./help-panel"), { ssr: false });

/** Pages with their own focus (paying, the order page, a conversation, the puzzle game). */
function hiddenOn(pathname: string): boolean {
  return /^\/(checkout|pay|order|print-job|j\/|contact\/t\/|puzzle\/)/.test(pathname + "/");
}

/**
 * Floating "Help" bubble, bottom right on every shop page: shoppers write to us
 * and read our replies without leaving the page. A red count shows replies
 * they haven't read; a reply that lands while it's closed peeks out above it.
 * Sits above the phone tab bar / cart strip / product bars.
 */
export default function HelpBubble() {
  const pathname = usePathname();
  const { threads, unread, seen } = useContactThreads();
  const [open, setOpen] = useState(false);
  const [startOn, setStartOn] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ id: string; text: string } | null>(null);
  const lastSeenReply = useRef<string | null>(null);
  /** Phones: tucked away while the page scrolls, back 0.8 s after it stops. */
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    let timer = 0;
    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), 800);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, []);

  /** Phones: "Need help?" beside the button once per visit, for a few seconds. */
  const [hint, setHint] = useState(false);

  useEffect(() => {
    // shown-at time, so a remount mid-way keeps showing it for the rest
    const SHOW_MS = 7000;
    let at = 0;
    try {
      at = Number(sessionStorage.getItem("sp_help_hint_at") ?? 0);
    } catch {}
    const timers: number[] = [];
    const show = (forMs: number) => {
      setHint(true);
      timers.push(window.setTimeout(() => setHint(false), forMs));
    };
    if (at) {
      const left = at + SHOW_MS - Date.now();
      if (left > 500) show(left);
    } else {
      timers.push(
        window.setTimeout(() => {
          try {
            sessionStorage.setItem("sp_help_hint_at", String(Date.now()));
          } catch {}
          show(SHOW_MS);
        }, 4000)
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setStartOn((e as CustomEvent<string | null>).detail ?? null);
      setOpen(true);
      setPeek(null);
    };
    window.addEventListener(HELP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(HELP_OPEN_EVENT, onOpen);
  }, []);

  // A new unread reply while closed: show its first words above the bubble.
  useEffect(() => {
    const newest = threads.find((t) => isUnread(t, seen));
    const sig = newest ? `${newest.id}:${newest.updatedAt}` : null;
    if (lastSeenReply.current === null) {
      lastSeenReply.current = sig ?? "";
      if (newest && !open) setPeek({ id: newest.id, text: newest.preview });
      return;
    }
    if (sig && sig !== lastSeenReply.current && !open) setPeek({ id: newest!.id, text: newest!.preview });
    lastSeenReply.current = sig ?? "";
  }, [threads, seen, open]);

  useEffect(() => setOpen(false), [pathname]);

  if (hiddenOn(pathname)) return null;

  return (
    <>
      {open && (
        <HelpPanel
          startOn={startOn}
          onClose={() => {
            setOpen(false);
            setStartOn(null);
          }}
        />
      )}
      {/* Phones/tablets: a small tab docked on the right edge that slides away
          while scrolling, so it never sits on buttons. Desktop: a pill. */}
      <div
        className={`help-dock fixed right-0 z-[61] flex flex-col items-end gap-2 transition-transform duration-300 lg:right-5 lg:translate-x-0 ${
          scrolling && !open && !peek ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
        }`}
      >
        {peek && !open && (
          <div className="relative mr-3 max-w-[15rem] rounded-2xl rounded-br-md lg:mr-0 border border-line bg-ink2 py-2.5 pr-8 pl-3 text-left shadow-xl">
            <button
              type="button"
              onClick={() => {
                setStartOn(peek.id);
                setOpen(true);
                setPeek(null);
              }}
              className="block text-left"
            >
              <span className="block text-[11px] font-bold tracking-wide text-[var(--chat-ink)] uppercase">StickyPie replied</span>
              <span className="mt-0.5 line-clamp-2 text-sm text-snow">{peek.text}</span>
            </button>
            <button
              type="button"
              aria-label="Hide"
              onClick={() => setPeek(null)}
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-fog hover:text-snow"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {hint && !open && !peek && (
          <button
            type="button"
            onClick={() => {
              setHint(false);
              setOpen(true);
            }}
            className="relative mr-3 rounded-2xl rounded-br-md border border-line bg-white px-3 py-2 text-left text-[13px] leading-tight font-semibold text-snow shadow-lg lg:hidden"
          >
            Need help? <span className="text-[var(--chat-ink)]">Chat with us</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setStartOn(null);
            setPeek(null);
            setHint(false);
          }}
          aria-label={open ? "Close help" : unread ? `Help: ${unread} new repl${unread === 1 ? "y" : "ies"}` : "Help: message us"}
          aria-expanded={open}
          className={`group relative flex items-center rounded-l-full bg-white py-[3px] pr-1.5 pl-[3px] shadow-[0_8px_22px_-8px_var(--chat-glow),0_2px_6px_rgba(16,24,40,0.12)] transition-transform duration-200 active:scale-95 lg:rounded-full lg:p-[3px] ${
            open ? "lg:rotate-0" : "lg:-rotate-6 lg:hover:rotate-0 lg:hover:scale-105"
          }`}
        >
          <span className="chat-gradient grid size-10 place-items-center rounded-full text-white lg:size-[50px]">
            {open ? <X className="size-5 lg:size-6" /> : <ChatFace className="size-[22px] lg:size-[26px]" />}
          </span>
          {/* Desktop: a label beside the sticker */}
          {!open && (
            <span className="hidden pr-4 pl-2.5 text-sm font-bold text-snow lg:block">
              {unread ? "New reply" : "Chat with us"}
            </span>
          )}
          {!open && unread > 0 && (
            <span className="absolute -top-1.5 left-6 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold text-white lg:-top-1.5 lg:right-[-6px] lg:left-auto">
              {unread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
