"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Unlink } from "lucide-react";
import { authClient, updatePassword } from "@/lib/shopper-auth";
import AuthShell from "./auth-shell";
import { PasswordField } from "./field";
import StickerLoader from "./sticker-loader";

type Stage = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordClient() {
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = authClient();
    if (!c) {
      setStage("invalid");
      return;
    }
    // Expired or already-used links come back with an error in the URL hash.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error") || hash.get("error_code")) {
      setStage("invalid");
      return;
    }
    // getSession() waits until the client has read the recovery tokens from the URL.
    c.auth.getSession().then(({ data }) => setStage(data.session ? "ready" : "invalid"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await updatePassword(password);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-sm">
      {stage === "checking" && (
        <div className="grid place-items-center pt-16">
          <StickerLoader size={56} />
        </div>
      )}

      {stage === "invalid" && (
        <div className="text-center lg:pt-8">
          <Unlink className="mx-auto size-10 text-fog" />
          <h1 className="mt-3 font-display text-xl font-bold">This link has expired</h1>
          <p className="mt-1 text-sm text-fog">
            Reset links work once and only for a short time. Request a fresh one.
          </p>
          <Link
            href="/account?forgot"
            className="pie-gradient mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25"
          >
            Send a new link
          </Link>
        </div>
      )}

      {stage === "ready" && (
        <form onSubmit={submit}>
          <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-fog">You&apos;ll be signed in once it&apos;s saved.</p>
          <div className="mt-5 space-y-3">
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="8+ characters"
            />
            <PasswordField
              label="Type it again"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p className="mt-3 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="pie-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy && <StickerLoader size={18} variant="onBrand" />}
            Save new password
          </button>
        </form>
      )}

      {stage === "done" && (
        <div className="text-center lg:pt-8">
          <CheckCircle2 className="mx-auto size-12 text-mint" />
          <h1 className="mt-3 font-display text-xl font-bold">Password updated</h1>
          <p className="mt-1 text-sm text-fog">You&apos;re signed in with your new password.</p>
          <Link
            href="/account"
            className="pie-gradient mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25"
          >
            Go to my orders
          </Link>
        </div>
      )}
      </div>
    </AuthShell>
  );
}
