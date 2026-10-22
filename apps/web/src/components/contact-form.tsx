"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send, Wand2 } from "lucide-react";
import { CONTACT_TOPICS, type ContactTopic } from "@stickypie/shared";
import { useShopper } from "@/lib/shopper-auth";
import { SelectField, TextField } from "./field";
import StickerLoader from "./sticker-loader";

const EMPTY = { name: "", email: "", phone: "", orderCode: "", message: "" };

/** Ready-to-edit message per topic (shown faded until used). */
const TEMPLATES: Record<ContactTopic, string> = {
  bulk: `Hi StickyPie team,

We'd like a bulk order for our business / event.

Design(s) or theme:
Size (3″ / 6″ / 7″):
Quantity:
Needed by (date):
Delivery city & PIN:
Logo / artwork: I'll share by email

Thanks!`,
  custom: `Hi StickyPie team,

I'd like custom stickers made.

What to print (idea, text or logo):
Size (3″ / 6″ / 7″):
Quantity:
Needed by (date):

Thanks!`,
  order: `Hi StickyPie team,

I need help with my order.

What happened:
What I'd like (replacement / address change / other):

Thanks!`,
  feedback: `Hi StickyPie team,

What I loved:
What could be better:
Sticker ideas I'd buy:`,
  general: `Hi StickyPie team,

`,
};

export default function ContactForm() {
  const shopper = useShopper();
  const [form, setForm] = useState(EMPTY);
  const [topic, setTopic] = useState<ContactTopic>("bulk");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Signed-in shoppers: pre-fill their email.
  useEffect(() => {
    if (shopper.email) setForm((f) => (f.email ? f : { ...f, email: shopper.email ?? "" }));
  }, [shopper.email]);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, topic, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't send your message.");
      setSent(true);
      setForm(EMPTY);
    } catch (err) {
      setError(
        err instanceof Error && !/fetch/i.test(err.message)
          ? err.message
          : "We couldn't reach StickyPie — check your connection and try again."
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-mint/30 bg-mint/5 p-6 text-center">
        <CheckCircle2 className="animate-pop mx-auto size-10 text-mint" />
        <p className="mt-3 font-display text-xl font-bold">Message sent!</p>
        <p className="mt-1 text-sm text-fog">Thanks for writing in — we usually reply within 1–2 business days.</p>
        <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-brand hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-ink2/40 p-3.5 sm:p-5">
      <h2 className="mb-3 hidden font-display text-lg font-bold sm:block">Send us a message</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <TextField label="Your name" autoComplete="name" value={form.name} onChange={set("name")} required />
        <TextField
          label="Mobile (10 digits)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={form.phone}
          onChange={(e) =>
            set("phone")({ target: { value: e.target.value.replace(/\D/g, "").replace(/^91(?=\d{10})/, "").slice(0, 10) } })
          }
          required
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          required
          className="col-span-2 sm:col-span-1"
        />
        <SelectField
          label="Topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className="col-span-2 sm:col-span-1"
        >
          {(Object.keys(CONTACT_TOPICS) as ContactTopic[]).map((t) => (
            <option key={t} value={t}>
              {CONTACT_TOPICS[t]}
            </option>
          ))}
        </SelectField>
        {topic === "order" && (
          <TextField
            label="Order number (optional)"
            value={form.orderCode}
            onChange={set("orderCode")}
            hint="Looks like SP-XXXXXXXX — it's on your order page"
            className="col-span-2"
          />
        )}
        <div className="col-span-2">
          <label className="relative block rounded-xl border border-line bg-ink2/70 transition-all duration-200 focus-within:border-brand/70 focus-within:shadow-[0_0_0_3px_rgba(255,46,99,0.14)] hover:border-fog/40">
            <span className="pointer-events-none absolute top-3 left-4 text-[10.5px] font-semibold tracking-widest text-fog uppercase">
              Message
            </span>
            <textarea
              rows={5}
              value={form.message}
              onChange={set("message")}
              placeholder={TEMPLATES[topic]}
              required
              className="h-36 w-full resize-y bg-transparent px-4 pt-8 pb-3 text-sm leading-relaxed sm:h-52 text-snow outline-none placeholder:text-fog/45"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const template = TEMPLATES[topic];
                const hasOwnText = form.message.trim() && form.message.trim() !== template.trim();
                if (hasOwnText && !confirm("Replace your message with the template?")) return;
                setForm((f) => ({ ...f, message: template }));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/5 px-3.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
            >
              <Wand2 className="size-3.5" /> Use template
            </button>
            <span className="hidden text-xs text-fog sm:inline">Fills in the outline above — edit anything you like.</span>
          </div>
        </div>
      </div>
      {/* Honeypot: hidden from people, bots fill it in. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        name="website"
      />
      {error && (
        <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">{error}</p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="pie-gradient mt-3 inline-flex w-full justify-center sm:w-auto items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-70"
      >
        {sending ? <StickerLoader size={18} variant="onBrand" /> : <Send className="size-4" />}
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
