"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, FileDown, Loader2, PackageCheck, Truck } from "lucide-react";
import type { Order } from "@stickypie/shared";
import { TextField } from "./field";
import { useToast } from "./toast";

/** Shiprocket on the order page: create the shipment when the package is ready. */
export default function ShiprocketPanel({ order, ready }: { order: Order; ready: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [parcel, setParcel] = useState({ weightKg: "0.1", lengthCm: "22", breadthCm: "15", heightCm: "2" });

  const booked = Boolean(order.shiprocketShipmentId && order.trackingNumber);
  const canShip = ["paid", "packed"].includes(order.status) && !booked;
  if (!booked && !canShip && !order.shiprocketShipmentId) return null;

  async function ship() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/shiprocket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: Number(parcel.weightKg),
          lengthCm: Number(parcel.lengthCm),
          breadthCm: Number(parcel.breadthCm),
          heightCm: Number(parcel.heightCm),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Shiprocket request failed");
      toast("Shipment created — print the label and keep the parcel ready for pickup");
      for (const w of (data.warnings as string[]) ?? []) toast(w, "error");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Shiprocket request failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const num = (key: keyof typeof parcel) => (e: { target: { value: string } }) =>
    setParcel((p) => ({ ...p, [key]: e.target.value.replace(/[^\d.]/g, "").slice(0, 6) }));

  return (
    <section className="mt-5 rounded-2xl border border-line bg-ink2 p-5">
      <div className="flex items-center gap-2">
        <Truck className="size-4 text-brand" />
        <h2 className="font-display text-lg font-semibold">Shiprocket</h2>
      </div>

      {booked ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <span className="text-fog">Courier</span> <b>{order.courier}</b> ·{" "}
            <span className="text-fog">AWB</span> <b className="select-text">{order.trackingNumber}</b>
          </p>
          <p className="text-fog">
            {order.status === "packed"
              ? "Waiting for pickup — the order moves to Shipped and Delivered automatically from Shiprocket's updates."
              : `Status: ${order.courierStatus ?? order.status}`}
            {order.courierStatus && order.status === "packed" && ` Latest: ${order.courierStatus}.`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {order.labelUrl && (
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noreferrer"
                className="pie-gradient inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white"
              >
                <FileDown className="size-4" /> Download label
              </a>
            )}
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-xs font-semibold text-fog hover:text-snow"
              >
                Track <ExternalLink className="size-3.5" />
              </a>
            )}
            {!order.labelUrl && (
              <button
                type="button"
                onClick={ship}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-xs font-semibold text-fog hover:text-snow"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />} Get label / retry pickup
              </button>
            )}
          </div>
        </div>
      ) : !ready ? (
        <p className="mt-2 text-xs leading-relaxed text-fog">
          Not connected. Create an API user in Shiprocket (Settings → API), then add SHIPROCKET_EMAIL,
          SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_LOCATION to the admin env file and restart the admin.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-fog">
            Package ready? Enter the packed parcel size — Shiprocket books the recommended courier,
            schedules pickup and gives you the label.
            {order.shiprocketShipmentId && " (Shipment already created — this finishes the booking.)"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TextField label="Weight (kg)" value={parcel.weightKg} inputMode="decimal" onChange={num("weightKg")} />
            <TextField label="Length (cm)" value={parcel.lengthCm} inputMode="decimal" onChange={num("lengthCm")} />
            <TextField label="Width (cm)" value={parcel.breadthCm} inputMode="decimal" onChange={num("breadthCm")} />
            <TextField label="Height (cm)" value={parcel.heightCm} inputMode="decimal" onChange={num("heightCm")} />
          </div>
          <button
            type="button"
            onClick={ship}
            disabled={busy}
            className="pie-gradient mt-3 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
            {order.status === "paid" ? "Package ready — pack & create shipment" : "Create Shiprocket shipment"}
          </button>
        </>
      )}
    </section>
  );
}
