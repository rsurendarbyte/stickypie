"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Truck } from "lucide-react";
import {
  INDIAN_STATES,
  REMOTE_STATES,
  ZONE_LABELS,
  formatINR,
  type ShippingZone,
  type StoreSettings,
} from "@stickypie/shared";
import { SelectField, TextField } from "./field";
import { useToast } from "./toast";

const ZONE_HINTS: Record<ShippingZone, string> = {
  local: "Same first 3 PIN digits as yours",
  state: "Anywhere else in your state",
  national: "Other states",
  remote: "North-East, J&K, Ladakh, islands",
};

const digits = (v: string) => v.replace(/\D/g, "");

export default function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [minOrder, setMinOrder] = useState(String(initial.minOrder));
  const [pincode, setPincode] = useState(initial.originPincode ?? "");
  const [state, setState] = useState(initial.originState ?? "");
  const [rates, setRates] = useState<Record<ShippingZone, string>>({
    local: String(initial.rates.local),
    state: String(initial.rates.state),
    national: String(initial.rates.national),
    remote: String(initial.rates.remote),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
    const payload = {
      minOrder: num(minOrder),
      originPincode: pincode.trim() || null,
      originState: state || null,
      rates: {
        local: num(rates.local),
        state: num(rates.state),
        national: num(rates.national),
        remote: num(rates.remote),
      },
    };
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      toast("Shipping settings saved");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-ink2 p-5 sm:col-span-2">
      <div className="flex items-center gap-2">
        <Truck className="size-4 text-fog" />
        <h2 className="text-sm font-semibold">Shipping &amp; checkout</h2>
      </div>
      <p className="mt-1 text-xs text-fog">
        Shipping is always charged, by distance from where you dispatch. Carts below the minimum
        order can&apos;t check out. Changes apply to the live shop straight away.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField
          label="Minimum order (₹)"
          value={minOrder}
          onChange={(e) => setMinOrder(digits(e.target.value))}
          inputMode="numeric"
          hint="Sticker subtotal, before shipping"
        />
        <TextField
          label="Dispatch PIN code"
          value={pincode}
          onChange={(e) => setPincode(digits(e.target.value).slice(0, 6))}
          inputMode="numeric"
          hint="Where parcels ship from"
        />
        <SelectField label="Dispatch state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Choose state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
      </div>

      <p className="mt-5 text-[10.5px] font-semibold tracking-widest text-fog uppercase">
        Shipping charge by distance
      </p>
      <div className="mt-2 grid gap-4 sm:grid-cols-4">
        {(Object.keys(ZONE_LABELS) as ShippingZone[]).map((zone) => (
          <TextField
            key={zone}
            label={`${ZONE_LABELS[zone]} (₹)`}
            value={rates[zone]}
            onChange={(e) => setRates((r) => ({ ...r, [zone]: digits(e.target.value) }))}
            inputMode="numeric"
            hint={ZONE_HINTS[zone]}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-fog/70">
        Remote areas: {REMOTE_STATES.join(", ")}.
      </p>

      {error && <p className="mt-3 text-xs text-brand">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="pie-gradient flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />} Save shipping settings
        </button>
        <span className="text-xs text-fog">
          Currently: minimum {formatINR(initial.minOrder)} · shipping{" "}
          {formatINR(Math.min(...Object.values(initial.rates)))}–
          {formatINR(Math.max(...Object.values(initial.rates)))}
          {!initial.originPincode && " · set your dispatch PIN for same-city rates"}
        </span>
      </div>
    </form>
  );
}
