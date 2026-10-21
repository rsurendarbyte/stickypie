"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { login, type LoginState } from "@/app/login/actions";
import { TextField } from "./field";

export default function LoginForm({ mode }: { mode: "demo" | "supabase" }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      {mode === "supabase" && (
        <TextField label="Email" name="email" type="email" required autoComplete="username" />
      )}
      <TextField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      {state.error && (
        <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="pie-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Sign in
      </button>

      {mode === "demo" ? (
        <p className="text-center text-[11px] leading-relaxed text-fog/70">
          Demo mode (no Supabase configured). The password comes from{" "}
          <code className="rounded bg-panel px-1 py-0.5">ADMIN_DEV_PASSWORD</code> — see
          apps/admin/.env.example for the default.
        </p>
      ) : (
        <p className="text-center text-[11px] leading-relaxed text-fog/70">
          Sign in with an admin account. Create one with{" "}
          <code className="rounded bg-panel px-1 py-0.5">npm run admin:create -- email</code>
        </p>
      )}
    </form>
  );
}
