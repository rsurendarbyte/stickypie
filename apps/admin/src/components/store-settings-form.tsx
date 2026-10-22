"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, ImageUp, Loader2, QrCode, Truck } from "lucide-react";
import {
  INDIAN_STATES,
  PAYMENT_GATEWAY_LABELS,
  REMOTE_STATES,
  ZONE_LABELS,
  formatINR,
  type PaymentGateway,
  type ShippingZone,
  type StoreSettings,
} from "@stickypie/shared";
import { SelectField, TextField } from "./field";
import SizePriceList, { priceRows, rowsToPrices } from "./size-price-list";
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
  const [business, setBusiness] = useState({
    name: initial.business.name ?? "",
    gstin: initial.business.gstin ?? "",
    address: initial.business.address ?? "",
    hsn: initial.business.hsn,
    gstRate: String(initial.business.gstRate),
    invoicePrefix: initial.business.invoicePrefix,
  });
  const setB = (key: keyof typeof business) => (e: { target: { value: string } }) =>
    setBusiness((b) => ({ ...b, [key]: e.target.value }));
  const [gateway, setGateway] = useState<PaymentGateway>(initial.paymentGateway);
  const [customPrices, setCustomPrices] = useState(() => priceRows(initial.customPrices));
  const [qrPrices, setQrPrices] = useState(() => priceRows(initial.qrPrices));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
    const payload = {
      paymentGateway: gateway,
      customPrices: rowsToPrices(customPrices),
      qrPrices: rowsToPrices(qrPrices),
      minOrder: num(minOrder),
      originPincode: pincode.trim() || null,
      originState: state || null,
      business: {
        name: business.name.trim() || null,
        gstin: business.gstin.trim().toUpperCase() || null,
        address: business.address.trim() || null,
        hsn: business.hsn.trim(),
        gstRate: num(business.gstRate),
        invoicePrefix: business.invoicePrefix.trim().toUpperCase(),
      },
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
        <CreditCard className="size-4 text-fog" />
        <h2 className="text-sm font-semibold">Payment gateway</h2>
      </div>
      <p className="mt-1 text-xs text-fog">
        New checkouts use this gateway. Orders already placed keep the one they were paid with, so you can switch any
        time. If its keys aren&apos;t set on the site, checkout uses the other one.
      </p>
      <div role="radiogroup" aria-label="Payment gateway" className="mt-3 grid gap-2 sm:grid-cols-2">
        {(Object.keys(PAYMENT_GATEWAY_LABELS) as PaymentGateway[]).map((g) => {
          const active = gateway === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setGateway(g)}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                active ? "border-brand bg-brand/[0.08] ring-1 ring-brand" : "border-line hover:border-fog/40"
              }`}
            >
              <span
                className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-brand" : "border-line"
                }`}
              >
                {active && <span className="size-2 rounded-full bg-brand" />}
              </span>
              <span>
                <span className="block text-sm font-semibold">{PAYMENT_GATEWAY_LABELS[g]}</span>
                <span className="block text-[11px] text-fog">
                  {g === "razorpay" ? "Pop-up checkout on the site" : "Hosted checkout page"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-line pt-5">
        <ImageUp className="size-4 text-fog" />
        <h2 className="text-sm font-semibold">Custom stickers</h2>
      </div>
      <p className="mt-1 text-xs text-fog">
        Price per custom sticker (shopper uploads their own artwork). Set a size to 0 to stop offering it.
        Turn the whole feature on or off in Features.
      </p>
      <SizePriceList value={customPrices} onChange={setCustomPrices} unit="custom" />

      <div className="mt-6 flex items-center gap-2 border-t border-line pt-5">
        <QrCode className="size-4 text-fog" />
        <h2 className="text-sm font-semibold">QR code stickers</h2>
      </div>
      <p className="mt-1 text-xs text-fog">
        Price per QR code sticker (made on the custom page from a UPI ID, link, WhatsApp number…). Set a
        size to 0 to stop offering it.
      </p>
      <SizePriceList value={qrPrices} onChange={setQrPrices} unit="QR" />

      <div className="mt-6 flex items-center gap-2 border-t border-line pt-5">
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

      <p className="mt-6 text-[10.5px] font-semibold tracking-widest text-fog uppercase">
        Business &amp; GST invoice
      </p>
      <p className="mt-1 text-xs text-fog">
        Printed on the tax invoice shoppers download after delivery. The download stays hidden until a
        GSTIN is set. Shop prices are before GST — checkout adds GST at this rate on stickers + shipping, and the invoice shows it.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <TextField label="Legal business name" value={business.name} onChange={setB("name")} />
        <TextField
          label="GSTIN"
          value={business.gstin}
          onChange={(e) => setB("gstin")({ target: { value: e.target.value.toUpperCase().slice(0, 15) } })}
          hint="15 characters, e.g. 29ABCDE1234F1Z5"
        />
        <TextField
          label="Registered address"
          value={business.address}
          onChange={setB("address")}
          className="sm:col-span-2"
          hint="Street, city, state, PIN — as on your GST registration"
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField
          label="HSN code"
          value={business.hsn}
          inputMode="numeric"
          onChange={(e) => setB("hsn")({ target: { value: digits(e.target.value).slice(0, 8) } })}
          hint="3919 = self-adhesive plastic stickers"
        />
        <TextField
          label="GST rate (%)"
          value={business.gstRate}
          inputMode="decimal"
          onChange={(e) => setB("gstRate")({ target: { value: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) } })}
        />
        <TextField
          label="Invoice prefix"
          value={business.invoicePrefix}
          onChange={(e) => setB("invoicePrefix")({ target: { value: e.target.value.toUpperCase().slice(0, 8) } })}
          hint="Numbers look like SP/2026-27/00001"
        />
      </div>

      {error && <p className="mt-3 text-xs text-brand">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="pie-gradient flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />} Save settings
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
