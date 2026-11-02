"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { TextField } from "./field";
import { useToast } from "./toast";

export type WaitingFeedback = {
  orderId: string;
  orderCode: string;
  customerName: string;
  email: string;
  rating: number;
  body: string | null;
  createdAt: string;
};

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

/** Default offer % (pre-filled for each new feedback below). */
export function DefaultPercentForm({ initial }: { initial: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings/offers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thanksPercent: Number(value) }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(typeof data.error === "string" ? data.error : "Couldn't save", "error");
    toast("Default offer saved");
    router.refresh();
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-ink2 p-4">
      <div className="w-36">
        <TextField
          label="Default offer (%)"
          value={value}
          inputMode="numeric"
          onChange={(e) => setValue(digits(e.target.value))}
        />
      </div>
      <button
        type="submit"
        disabled={saving || !value}
        className="h-11 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <p className="min-w-0 flex-1 basis-60 text-xs text-fog">
        Filled in for each new feedback below. You can change it for each customer.
      </p>
    </form>
  );
}

/** Feedback that has no decision yet: give an offer (any %) or no offer. */
export function WaitingList({ items, defaultPercent }: { items: WaitingFeedback[]; defaultPercent: number }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-ink2 p-5 text-center text-sm text-fog">
        No feedback waiting. New ratings from the thank-you card show up here.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((f) => (
        <WaitingRow key={f.orderId} f={f} defaultPercent={defaultPercent} />
      ))}
    </ul>
  );
}

function WaitingRow({ f, defaultPercent }: { f: WaitingFeedback; defaultPercent: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [percent, setPercent] = useState(String(defaultPercent));
  const [busy, setBusy] = useState(false);
  async function decide(value: number | null) {
    setBusy(true);
    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: f.orderId, percent: value }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(typeof data.error === "string" ? data.error : "Couldn't save", "error");
    toast(value === null ? "Marked: no offer" : `${value}% offer given to ${f.customerName}`);
    router.refresh();
  }
  return (
    <li className="rounded-2xl border border-line bg-ink2 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-0.5 text-gold" aria-label={`${f.rating} of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`size-4 ${n <= f.rating ? "fill-current" : "opacity-25"}`} />
          ))}
        </span>
        <span className="text-sm font-semibold">{f.customerName}</span>
        <Link href={`/orders/${f.orderId}`} className="text-xs text-fog hover:text-brand">
          {f.orderCode}
        </Link>
        <span className="truncate text-xs text-fog">{f.email}</span>
      </div>
      {f.body && <p className="mt-2 text-sm text-snow/90">&ldquo;{f.body}&rdquo;</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex h-10 items-center gap-1 rounded-xl border border-line bg-ink px-3 text-sm">
          <input
            value={percent}
            onChange={(e) => setPercent(digits(e.target.value))}
            inputMode="numeric"
            aria-label="Offer percent"
            className="w-8 bg-transparent text-right font-bold outline-none"
          />
          % off
        </label>
        <button
          type="button"
          disabled={busy || !Number(percent)}
          onClick={() => decide(Number(percent))}
          className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Give offer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(null)}
          className="h-10 rounded-xl border border-line px-4 text-sm font-semibold text-fog hover:text-snow disabled:opacity-40"
        >
          No offer
        </button>
      </div>
    </li>
  );
}
