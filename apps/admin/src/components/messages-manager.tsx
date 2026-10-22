"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";
import { CONTACT_TOPICS, type ContactMessage } from "@stickypie/shared";
import { useToast } from "./toast";

export default function MessagesManager({ initial }: { initial: ContactMessage[] }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState(initial);
  const [tab, setTab] = useState<"new" | "resolved">("new");
  const shown = messages.filter((m) => m.status === tab);

  async function setStatus(m: ContactMessage, status: "new" | "resolved") {
    const res = await fetch(`/api/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return toast("Couldn't update the message", "error");
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, status } : x)));
    toast(status === "resolved" ? "Marked resolved" : "Moved back to new");
  }

  async function remove(m: ContactMessage) {
    if (!confirm("Delete this message permanently?")) return;
    const res = await fetch(`/api/messages/${m.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Couldn't delete the message", "error");
    setMessages((list) => list.filter((x) => x.id !== m.id));
    toast("Message deleted");
  }

  return (
    <>
      <div className="flex gap-1.5">
        {(["new", "resolved"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t ? "pie-gradient text-white" : "border border-line text-fog hover:text-snow"
            }`}
          >
            {t === "new" ? "New" : "Resolved"}{" "}
            <span className="opacity-75">({messages.filter((m) => m.status === t).length})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
          {tab === "new" ? "No new messages." : "Nothing resolved yet."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((m) => (
            <li key={m.id} className="rounded-2xl border border-line bg-ink2 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold">{m.name}</p>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                  {CONTACT_TOPICS[m.topic] ?? m.topic}
                </span>
                {m.orderCode && <span className="text-xs font-semibold text-gold">{m.orderCode}</span>}
                <span className="ml-auto text-xs text-fog">{new Date(m.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-fog">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to StickyPie")}`}
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  <Mail className="size-3.5" /> {m.email}
                </a>
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-snow">
                    <Phone className="size-3.5" /> {m.phone}
                  </a>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-snow/90 select-text">{m.message}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                {m.status === "new" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(m, "resolved")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25"
                  >
                    <CheckCircle2 className="size-3.5" /> Mark resolved
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(m, "new")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow"
                  >
                    <RotateCcw className="size-3.5" /> Reopen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(m)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-fog hover:text-brand"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
