"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

/** Shopper's answer box on their private conversation page. */
export default function ContactThreadReply({ id, accessKey }: { id: string; accessKey: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/contact/t/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: accessKey, body, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't send your message.");
      setBody("");
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && !/fetch/i.test(err.message)
          ? err.message
          : "We couldn't reach StickyPie. Check your connection and try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-line bg-ink2/40 p-3">
      <label htmlFor="thread-reply" className="sr-only">
        Your message
      </label>
      <textarea
        id="thread-reply"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setError(null);
          setSent(false);
        }}
        rows={3}
        maxLength={2000}
        placeholder="Write back to StickyPie…"
        className="w-full resize-y rounded-xl border border-line bg-ink px-3 py-2.5 text-[16px] text-snow outline-none placeholder:text-fog/70 focus:border-brand/60 sm:text-sm"
      />
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
      {sent && !error && <p className="mt-2 text-sm text-mint">Sent. We&apos;ll reply here and by email.</p>}
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="pie-gradient inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-md shadow-brand/25 disabled:opacity-50"
        >
          <Send className="size-4" /> {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
