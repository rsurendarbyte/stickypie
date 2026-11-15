"use client";

import { ChevronRight, MessageCircle } from "lucide-react";
import { isUnread, useContactThreads, type ThreadRow } from "@/lib/contact-live";

const LABEL: Record<ThreadRow["status"], { text: string; cls: string }> = {
  replied: { text: "We replied", cls: "bg-brand/10 text-brand" },
  new: { text: "Waiting for us", cls: "bg-gold/15 text-gold" },
  resolved: { text: "Sorted", cls: "bg-mint/15 text-mint" },
};

/** Conversation rows (contact page, account page, help bubble). */
export function ThreadRows({
  threads,
  seen,
  onOpen,
  limit = 20,
}: {
  threads: ThreadRow[];
  seen: Record<string, string>;
  /** Help bubble opens the chat in place; elsewhere rows are links. */
  onOpen?: (t: ThreadRow) => void;
  limit?: number;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink2/50">
      {threads.slice(0, limit).map((t) => {
        const unread = isUnread(t, seen);
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                {unread && <span aria-label="New reply" className="size-2 shrink-0 rounded-full bg-brand" />}
                <span className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"}`}>{t.topic}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${LABEL[t.status].cls}`}>
                  {LABEL[t.status].text}
                </span>
              </span>
              <span className={`mt-0.5 block truncate text-xs ${unread ? "text-snow" : "text-fog"}`}>
                {t.lastFrom === "admin" ? "StickyPie: " : "You: "}
                {t.preview}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-fog" />
          </>
        );
        const cls = "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-ink2";
        return (
          <li key={t.id}>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(t)} className={cls}>
                {body}
              </button>
            ) : (
              <a href={t.path} className={cls}>
                {body}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Your conversations": contact threads from the signed-in account's email and
 * the links this browser kept. Hidden when there are none. Live.
 */
export default function ContactThreads({ variant }: { variant: "account" | "contact" }) {
  const { threads, seen } = useContactThreads();
  if (!threads.length) return null;
  const compact = variant === "contact";
  return (
    <section id="conversations" className={compact ? "mt-4 min-w-0 lg:mt-5" : "mt-8 min-w-0"}>
      <h2 className={`flex items-center gap-2 font-display font-bold ${compact ? "text-base" : "text-lg"}`}>
        <MessageCircle className={`text-brand ${compact ? "size-4" : "size-5"}`} />
        {compact ? "Your conversations" : "My messages"}
      </h2>
      <div className="mt-2">
        <ThreadRows threads={threads} seen={seen} limit={compact ? 5 : 20} />
      </div>
    </section>
  );
}
