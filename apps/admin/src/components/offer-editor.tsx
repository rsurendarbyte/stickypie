"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./toast";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 2);

/**
 * A given offer (not used yet): change its %, switch it off/on, or turn a
 * "no offer" decision into an offer.
 */
export default function OfferEditor({
  id,
  percent,
  disabled,
  defaultPercent,
}: {
  id: string;
  percent: number;
  disabled: boolean;
  defaultPercent: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const noOffer = percent === 0;
  const [value, setValue] = useState(String(noOffer ? defaultPercent : percent));
  const [busy, setBusy] = useState(false);

  async function save(patch: { percent?: number; disabled?: boolean }, done: string) {
    setBusy(true);
    const res = await fetch(`/api/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(typeof data.error === "string" ? data.error : "Couldn't update the offer", "error");
    toast(done);
    router.refresh();
  }

  const n = Number(value);
  const valid = n >= 1 && n <= 50;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-9 items-center gap-1 rounded-xl border border-line bg-ink px-3 text-sm">
        <input
          value={value}
          onChange={(e) => setValue(digits(e.target.value))}
          inputMode="numeric"
          aria-label="Offer percent"
          className="w-7 bg-transparent text-right font-bold outline-none"
        />
        %
      </label>
      {noOffer ? (
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() => save({ percent: n, disabled: false }, `${n}% offer given`)}
          className="h-9 rounded-xl bg-brand px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          Give offer
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => save({ percent: n }, `Offer changed to ${n}%`)}
            className="h-9 rounded-xl bg-brand px-3 text-xs font-bold text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ disabled: !disabled }, disabled ? "Offer turned on" : "Offer turned off")}
            className="h-9 rounded-xl border border-line px-3 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-snow disabled:opacity-50"
          >
            {disabled ? "Turn on" : "Turn off"}
          </button>
        </>
      )}
    </div>
  );
}
