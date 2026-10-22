"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { TextAreaField, TextField } from "./field";

/**
 * "Need something more custom?" — shape, finish, bulk, design help. Saved as a
 * contact message (topic: custom stickers) so the admin sees it in Messages
 * and gets an email; we reach the shopper on WhatsApp or email.
 */
/** One tap fills the message with a starter the shopper just completes. */
const TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Bulk order",
    text: "I need about ___ stickers of my logo/design for my business.\nSize: ___\nNeeded by: ___",
  },
  {
    label: "Special shape or size",
    text: "I'd like a custom shape/size sticker.\nSize (width × height): ___\nQuantity: ___",
  },
  {
    label: "Event stickers",
    text: "Stickers for an event (wedding / birthday / college fest / office) on ___.\nAbout ___ pieces.",
  },
  {
    label: "Design help",
    text: "I don't have a design ready — please help me make one.\nMy idea: ___\nQuantity: ___",
  },
  {
    label: "Different finish",
    text: "Can you print in a different finish (matte / glossy / transparent / holographic)?\nQuantity: ___",
  },
];

export default function CustomRequestForm() {
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "", details: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.whatsapp,
        topic: "custom",
        message: `Custom sticker request (reply on WhatsApp ${form.whatsapp} or email).\n\n${form.details}`,
        website: form.website,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    if (!res?.ok) {
      setError(data.error ?? "Couldn't send your request. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <section className="mt-12 rounded-3xl border border-line bg-ink2 p-5 sm:p-8 lg:grid lg:grid-cols-[1fr_1.3fr] lg:gap-10">
      <div>
        <span className="grid size-11 place-items-center rounded-2xl bg-mint/15 text-mint">
          <MessageCircle className="size-5.5" />
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold">Need something more custom?</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-fog">
          A special shape or size, a different finish, a bulk order for your business or event, or help
          designing your sticker — tell us what you have in mind and we&apos;ll get back to you personally on
          WhatsApp or email.
        </p>
      </div>

      {sent ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-mint/10 p-5 lg:mt-0">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint" />
          <p className="text-sm text-snow">
            Thanks, {form.name.split(" ")[0] || "there"}! We&apos;ve got your request and will contact you on WhatsApp
            ({form.whatsapp}) or email soon.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-0">
          <TextField label="Your name" value={form.name} onChange={set("name")} autoComplete="name" required />
          <TextField
            label="WhatsApp number"
            value={form.whatsapp}
            onChange={set("whatsapp")}
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            required
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-semibold text-fog">Start with a template</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, details: t.text }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.details === t.text
                      ? "border-brand bg-brand/[0.06] text-brand"
                      : "border-line bg-ink text-fog hover:border-fog/40 hover:text-snow"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField
            label="What do you need?"
            value={form.details}
            onChange={set("details")}
            rows={4}
            required
            className="sm:col-span-2"
            hint="Pick a template above or write your own — fill in the blanks (___)."
          />
          {/* Honeypot: hidden from people, bots fill it. */}
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={set("website")}
            className="hidden"
            aria-hidden
          />
          {error && <p className="text-sm font-semibold text-brand sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="peel-btn peel-btn--brand flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold sm:col-span-2"
          >
            {sending && <Loader2 className="size-4 animate-spin" />}
            Send request
          </button>
        </form>
      )}
    </section>
  );
}
