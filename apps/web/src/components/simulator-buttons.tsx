"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import StickerLoader from "./sticker-loader";

export default function SimulatorButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(outcome: "success" | "failure") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/pay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Simulation failed");
      }
      router.push(`/order/${orderId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => simulate("success")}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint/90 py-3 text-sm font-bold text-ink transition-all hover:bg-mint disabled:opacity-60"
      >
        {busy === "success" ? (
          <StickerLoader size={18} variant="onBrand" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Simulate successful payment
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => simulate("failure")}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 py-3 text-sm font-bold text-brand transition-all hover:bg-brand/20 disabled:opacity-60"
      >
        {busy === "failure" ? (
          <StickerLoader size={18} variant="onBrand" />
        ) : (
          <XCircle className="size-4" />
        )}
        Simulate failed payment
      </button>
      {error && <p className="text-center text-xs text-brand">{error}</p>}
    </div>
  );
}
