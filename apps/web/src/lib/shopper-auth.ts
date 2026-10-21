"use client";

// Shopper sign-in in the browser (Supabase Auth, email + password). The
// session lives in localStorage and refreshes itself; API calls send its
// access token so the server knows who is ordering.
import { useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** null in demo mode (no Supabase configured) — the shop stays guest-only. */
export function authClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: "stickypie.auth" },
        })
      : null;
  return client;
}

export function useShopper() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const c = authClient();
    if (!c) {
      setReady(true);
      return;
    }
    c.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = c.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return {
    enabled: authClient() !== null,
    ready,
    session,
    email: session?.user.email ?? null,
  };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const c = authClient();
  if (!c) throw new Error("Sign-in is not available");
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) {
    throw new Error(
      /invalid login credentials/i.test(error?.message ?? "")
        ? "Email or password is incorrect."
        : (error?.message ?? "Could not sign in.")
    );
  }
  return data.session;
}

/** Creates the account (confirmed instantly) and signs straight in. */
export async function createAccount(email: string, password: string, name: string): Promise<Session> {
  const res = await fetch("/api/account/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Could not create your account.");
  }
  return signIn(email, password);
}

export async function signOut(): Promise<void> {
  await authClient()?.auth.signOut();
}
