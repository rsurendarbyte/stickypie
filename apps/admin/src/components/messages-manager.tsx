"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Mail, MessageCircle, Phone, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  CONTACT_TOPICS,
  contactThreadPath,
  type ContactMessage,
  type ContactReply,
  type ContactStatus,
} from "@stickypie/shared";
import { useToast } from "./toast";
import { MESSAGES_EVENT } from "./message-alerts";

const TABS: { key: ContactStatus; label: string; empty: string }[] = [
  { key: "new", label: "Needs reply", empty: "Nothing waiting for a reply." },
  { key: "replied", label: "Waiting on customer", empty: "No conversations waiting on a customer." },
  { key: "resolved", label: "Resolved", empty: "Nothing resolved yet." },
];

/** One shopper (same email) in one tab: all their messages as one conversation. */
type Group = { key: string; messages: ContactMessage[]; latest: ContactMessage; lastAt: string };

type Bubble =
  | { kind: "message"; at: string; m: ContactMessage }
  | { kind: "reply"; at: string; r: ContactReply };

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

function lastActivity(m: ContactMessage): string {
  return m.replies.at(-1)?.createdAt ?? m.createdAt;
}

export default function MessagesManager({ initial, webUrl }: { initial: ContactMessage[]; webUrl: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState(initial);
  const [tab, setTab] = useState<ContactStatus>("new");

  // Live: new messages and shopper answers appear without a reload.
  useEffect(() => {
    const onLive = (e: Event) => {
      const list = (e as CustomEvent<ContactMessage[]>).detail;
      if (Array.isArray(list)) setMessages(list);
    };
    window.addEventListener(MESSAGES_EVENT, onLive);
    return () => window.removeEventListener(MESSAGES_EVENT, onLive);
  }, []);

  const groups = useMemo(() => {
    const byKey = new Map<string, ContactMessage[]>();
    for (const m of messages) {
      const key = `${m.status}:${m.email.toLowerCase()}`;
      byKey.set(key, [...(byKey.get(key) ?? []), m]);
    }
    const out: Group[] = [];
    for (const [key, list] of byKey) {
      const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const latest = sorted.at(-1)!;
      const lastAt = sorted.map(lastActivity).sort().at(-1)!;
      out.push({ key, messages: sorted, latest, lastAt });
    }
    return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [messages]);

  const count = (s: ContactStatus) => groups.filter((g) => g.latest.status === s).length;
  const shown = groups.filter((g) => g.latest.status === tab);

  function patch(ids: string[], fn: (m: ContactMessage) => ContactMessage) {
    setMessages((list) => list.map((m) => (ids.includes(m.id) ? fn(m) : m)));
  }

  async function setStatus(g: Group, status: ContactStatus) {
    const ids = g.messages.map((m) => m.id);
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/messages/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).then((r) => r.ok)
      )
    );
    if (results.some((ok) => !ok)) return toast("Couldn't update the conversation", "error");
    patch(ids, (m) => ({ ...m, status }));
    toast(status === "resolved" ? "Marked resolved" : "Moved back to Needs reply");
  }

  async function remove(m: ContactMessage) {
    if (!confirm("Delete this message and its replies permanently?")) return;
    const res = await fetch(`/api/messages/${m.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Couldn't delete the message", "error");
    setMessages((list) => list.filter((x) => x.id !== m.id));
    toast("Message deleted");
  }

  /** Saves the reply on the newest message; emails it unless sendEmail is false. */
  async function reply(g: Group, body: string, sendEmail: boolean): Promise<boolean> {
    const target = g.latest;
    const alsoIds = g.messages.filter((m) => m.id !== target.id && m.status !== "resolved").map((m) => m.id);
    const res = await fetch(`/api/messages/${target.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, alsoIds, email: sendEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(typeof data.error === "string" ? data.error : "Couldn't send the reply", "error");
      return false;
    }
    patch([target.id], (m) => ({ ...m, status: "replied", replies: [...m.replies, data.reply as ContactReply] }));
    patch(alsoIds, (m) => ({ ...m, status: "replied" }));
    if (!sendEmail) toast("Reply saved");
    else if (data.emailed) toast(`Reply emailed to ${target.email}`);
    else toast("Reply saved, but the email didn't go out. Send it on WhatsApp.", "error");
    return true;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key ? "pie-gradient text-white" : "border border-line text-fog hover:text-snow"
            }`}
          >
            {t.label} <span className="opacity-75">({count(t.key)})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
          {TABS.find((t) => t.key === tab)!.empty}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((g) => (
            <Conversation
              key={g.key}
              group={g}
              webUrl={webUrl}
              onReply={(body, email) => reply(g, body, email)}
              onStatus={(s) => setStatus(g, s)}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function Conversation({
  group,
  webUrl,
  onReply,
  onStatus,
  onDelete,
}: {
  group: Group;
  webUrl: string;
  onReply: (body: string, email: boolean) => Promise<boolean>;
  onStatus: (s: ContactStatus) => void;
  onDelete: (m: ContactMessage) => void;
}) {
  const { latest } = group;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const phone = group.messages.map((m) => m.phone).filter(Boolean).at(-1) ?? null;
  const threadUrl = `${webUrl}${contactThreadPath(latest)}`;
  const status = latest.status;

  const bubbles: Bubble[] = group.messages
    .flatMap<Bubble>((m) => [
      { kind: "message", at: m.createdAt, m },
      ...m.replies.map<Bubble>((r) => ({ kind: "reply", at: r.createdAt, r })),
    ])
    .sort((a, b) => a.at.localeCompare(b.at));

  const lastOurs = [...bubbles].reverse().find((b) => b.kind === "reply" && b.r.author === "admin");

  function whatsappHref(text: string) {
    const digits = (phone ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    return `https://wa.me/91${digits}?text=${encodeURIComponent(`${text}\n\nSee our full conversation: ${threadUrl}`)}`;
  }

  async function send(viaWhatsApp: boolean) {
    const body = draft.trim();
    if (!body) return;
    // Open the WhatsApp tab now (inside the click), or the browser blocks it.
    const win = viaWhatsApp ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    const ok = await onReply(body, true);
    setBusy(false);
    if (ok) {
      setDraft("");
      if (win) win.location.href = whatsappHref(body);
    } else win?.close();
  }

  return (
    <li className="rounded-2xl border border-line bg-ink2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold">{latest.name}</p>
        {group.messages.length > 1 && (
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-fog">
            {group.messages.length} messages
          </span>
        )}
        <span className="ml-auto text-xs text-fog">Last activity {when(group.lastAt)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fog">
        <a href={`mailto:${latest.email}`} className="inline-flex items-center gap-1 text-brand hover:underline">
          <Mail className="size-3.5" /> {latest.email}
        </a>
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-snow">
            <Phone className="size-3.5" /> {phone}
          </a>
        )}
        <a href={threadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-snow">
          <ExternalLink className="size-3.5" /> Shopper&apos;s page
        </a>
      </div>

      <ol className="mt-3 space-y-2">
        {bubbles.map((b) =>
          b.kind === "message" ? (
            <li key={b.m.id} className="mr-6 rounded-xl rounded-tl-sm border border-line bg-ink px-3 py-2.5 sm:mr-16">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fog">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 font-bold text-brand">
                  {CONTACT_TOPICS[b.m.topic] ?? b.m.topic}
                </span>
                {b.m.orderCode && <span className="font-semibold text-gold">{b.m.orderCode}</span>}
                <span>{when(b.at)}</span>
                <button
                  type="button"
                  onClick={() => onDelete(b.m)}
                  title="Delete this message"
                  className="ml-auto inline-flex items-center gap-1 hover:text-brand"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-snow/90 select-text">{b.m.message}</p>
            </li>
          ) : (
            <li
              key={b.r.id}
              className={
                b.r.author === "admin"
                  ? "ml-6 rounded-xl rounded-tr-sm bg-mint/10 px-3 py-2.5 sm:ml-16"
                  : "mr-6 rounded-xl rounded-tl-sm border border-line bg-ink px-3 py-2.5 sm:mr-16"
              }
            >
              <p className="text-[11px] text-fog">
                <span className="font-bold">{b.r.author === "admin" ? "You (StickyPie)" : latest.name}</span> · {when(b.at)}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-snow/90 select-text">{b.r.body}</p>
            </li>
          )
        )}
      </ol>

      <div className="mt-3 border-t border-line pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={`Reply to ${latest.name.split(" ")[0]}… (emailed with a link to their conversation page)`}
          className="w-full resize-y rounded-xl border border-line bg-ink px-3 py-2 text-sm text-snow outline-none placeholder:text-fog/70 focus:border-brand/60"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => send(false)}
            className="pie-gradient inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <Send className="size-3.5" /> {busy ? "Sending…" : "Send reply"}
          </button>
          {phone && (
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => send(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366]/15 px-3 py-1.5 text-xs font-bold text-[#25d366] hover:bg-[#25d366]/25 disabled:opacity-50"
            >
              <MessageCircle className="size-3.5" /> Send + WhatsApp
            </button>
          )}
          {phone && !draft.trim() && lastOurs?.kind === "reply" && (
            <a
              href={whatsappHref(lastOurs.r.body)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#25d366] hover:underline"
            >
              WhatsApp last reply
            </a>
          )}
          <span className="ml-auto flex gap-2">
            {status !== "resolved" ? (
              <button
                type="button"
                onClick={() => onStatus("resolved")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25"
              >
                <CheckCircle2 className="size-3.5" /> Mark resolved
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStatus("new")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow"
              >
                <RotateCcw className="size-3.5" /> Reopen
              </button>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
