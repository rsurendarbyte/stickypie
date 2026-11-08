"use client";

import { useState } from "react";
import Link from "@/components/page-link";
import { UserPlus } from "lucide-react";
import { finishSignup, startSignup, useShopper } from "@/lib/shopper-auth";
import { PasswordField } from "./field";
import StickerLoader from "./sticker-loader";

/**
 * Paid guest order: make an account with the email used at checkout. The
 * emailed code confirms it, then this order and the other guest orders with
 * that email join the account (AuthCookieSync asks the server on sign-in).
 */
export default function GuestAccountBox({ orderId, email, name }: { orderId: string; email: string; name: string }) {
  const shopper = useShopper();
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Signed in already: their guest orders move over on their own.
  if (!shopper.enabled || !shopper.ready || shopper.email) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    if (codeSent && !/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      if (!codeSent) {
        const result = await startSignup(email, password);
        if ("codeSent" in result) {
          setCodeSent(true);
          return;
        }
      } else {
        await finishSignup(email, password, name, code.trim());
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="mx-auto mb-6 max-w-xl rounded-2xl border border-line bg-panel/60 p-4 text-sm">
        <StickerLoader size={16} /> Account ready — moving your orders to it…
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mb-6 max-w-xl rounded-2xl border border-line bg-panel/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <UserPlus className="size-4 text-brand" /> Keep your orders in one place
      </p>
      <p className="mt-1 text-xs text-fog">
        Make an account with <b className="break-all text-snow">{email}</b>: this order and any other guest orders
        with this email show in My orders. Optional.
      </p>
      <div className="mt-3 grid gap-3">
        <PasswordField
          label="Create a password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          hint={codeSent ? undefined : "8+ characters"}
        />
        {codeSent && (
          <div>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              aria-label="6-digit code"
              autoFocus
              className="h-12 w-full rounded-xl border border-line bg-ink2 px-4 text-center font-display text-lg font-bold tracking-[0.4em] outline-none focus:border-brand/60"
            />
            <p className="mt-1 text-xs text-fog">We emailed a code to {email}. Check spam if it isn&apos;t there.</p>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">{error}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="peel-btn peel-btn--brand inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
        >
          {busy && <StickerLoader size={16} variant="onBrand" />}
          {codeSent ? "Verify & create account" : "Create account"}
        </button>
        <Link
          href={`/account?next=${encodeURIComponent(`/order/${orderId}`)}`}
          className="text-xs font-semibold text-fog hover:text-brand"
        >
          I have an account
        </Link>
      </div>
    </form>
  );
}
