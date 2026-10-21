"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";
import StickerLoader from "./sticker-loader";

// Cashfree usually confirms within a few seconds of the shopper returning.
// Each refresh re-runs the order page on the server, which asks Cashfree for
// the latest status and marks the order paid as soon as it is.
const DELAYS_MS = [2000, 3000, 3000, 4000, 5000, 5000, 8000, 10000, 15000, 20000];

export default function PaymentPending() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const checking = attempt < DELAYS_MS.length;

  useEffect(() => {
    if (!checking) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempt((a) => a + 1);
    }, DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [attempt, checking, router]);

  if (checking) {
    return (
      <>
        <StickerLoader size={72} className="mx-auto" />
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Confirming your payment…</h1>
        <p className="mt-2 text-sm text-fog">
          This usually takes a few seconds — no need to refresh or pay again.
        </p>
      </>
    );
  }

  return (
    <>
      <Clock3 className="mx-auto size-16 text-gold" />
      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Payment pending</h1>
      <p className="mt-2 text-sm text-fog">
        We haven&apos;t heard back from the payment provider yet. If money left your account, your
        order will update on its own — check again in a minute.
      </p>
      <button
        type="button"
        onClick={() => setAttempt(0)}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-ink2 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
      >
        <RefreshCw className="size-4" /> Check again
      </button>
    </>
  );
}
