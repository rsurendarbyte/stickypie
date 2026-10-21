import type { Metadata } from "next";
import LoginForm from "@/components/login-form";
import { supabaseConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

// Mode (demo vs Supabase) depends on runtime env — never prerender this page.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const mode = supabaseConfigured() ? "supabase" : "demo";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-brand/15 blur-[110px]" />
      <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-brand2/10 blur-[110px]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-ink2 p-7 shadow-2xl">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-3 size-14 -rotate-6 rounded-2xl shadow-lg shadow-amber-500/20"
        />
        <p className="text-center font-display text-3xl font-semibold">
          Sticky<span className="text-pie">Pie</span>
        </p>
        <p className="mt-1 text-center text-xs font-semibold tracking-[0.2em] text-fog uppercase">
          Admin console
        </p>
        <div className="mt-7">
          <LoginForm mode={mode} />
        </div>
        <p className="mt-5 text-center text-[11px] text-fog/60">
          {mode === "demo" ? "Mode: local demo store" : "Mode: Supabase"}
        </p>
      </div>
    </div>
  );
}
