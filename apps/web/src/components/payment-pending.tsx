"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, CreditCard, Lock, RefreshCw } from "lucide-react";
import { formatINR } from "@stickypie/shared";
import { openPayment } from "@/lib/open-payment";
import { authClient } from "@/lib/shopper-auth";
import StickerLoader from "./sticker-loader";

// The gateway usually confirms within a few seconds of the shopper returning.
// Each refresh re-runs the order page on the server, which asks the gateway for
// the latest status and marks the order paid as soon as it is.
const DELAYS_MS = [2000, 3000, 3000, 4000, 5000, 5000, 8000, 10000, 15000, 20000];

/**
 * Order still unpaid. `awaitingShopper` = the gateway has no payment in progress
 * (they closed the payment page, or the attempt failed) → offer "Pay now",
 * which reopens the same payment session. Otherwise keep checking.
 */
export default function PaymentPending({
  orderId,
  total,
  awaitingShopper,
  lastAttempt,
}: {
  orderId: string;
  total: number;
  awaitingShopper: boolean;
  lastAttempt: string | null;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const checking = !awaitingShopper && attempt < DELAYS_MS.length;

  useEffect(() => {
    if (!checking) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempt((a) => a + 1);
    }, DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [attempt, checking, router]);

  async function payNow() {
    setPaying(true);
    setError(null);
    try {
      const token = (await authClient()?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/pay/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "expired") router.refresh();
        setNeedsSignIn(data.code === "auth_required");
        throw new Error(typeof data.error === "string" ? data.error : "Couldn't open the payment page.");
      }
      await openPayment(
        data,
        (url) => {
          router.push(url);
          router.refresh();
        },
        () => setPaying(false)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the payment page.");
      setPaying(false);
    }
  }

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

  if (awaitingShopper) {
    const failedAttempt = lastAttempt === "FAILED";
    return (
      <>
        <CreditCard className="mx-auto size-16 text-gold" />
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          {failedAttempt ? "Payment didn't go through" : "Payment not completed"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fog">
          {failedAttempt
            ? "No money was taken. Try again — UPI, another card or NetBanking all work."
            : "Your order is saved and no money was taken. Finish paying to confirm it."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={payNow}
            disabled={paying}
            className="peel-btn peel-btn--brand inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-70"
          >
            {paying ? <StickerLoader size={18} variant="onBrand" /> : <Lock className="size-4" />}
            {paying ? "Opening payment…" : `Pay ${formatINR(total)} now`}
          </button>
          <Link
            href="/checkout"
            className="peel-btn peel-btn--light rounded-xl px-5 py-3 text-sm font-bold"
          >
            Change items or address
          </Link>
        </div>
        {error && (
          <p className="mt-3 text-sm text-brand">
            {error}{" "}
            {needsSignIn && (
              <Link href="/account" className="font-semibold underline">
                Sign in
              </Link>
            )}
          </p>
        )}
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
        className="peel-btn peel-btn--light mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
      >
        <RefreshCw className="size-4" /> Check again
      </button>
    </>
  );
}
