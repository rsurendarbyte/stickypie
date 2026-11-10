"use client";

// Shopper sign-in in the browser (Supabase Auth, email + password). The
// session lives in localStorage and refreshes itself; API calls send its
// access token so the server knows who is ordering.
//
// supabase-js is big (about 64 KB compressed) and almost every visitor is a
// guest, so it loads only when it's needed: a session saved in this browser, a
// sign-in link in the address bar, or the shopper signing in.
import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_EMAIL } from "@stickypie/shared";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_KEY = "stickypie.auth";
const READY = "stickypie:auth-ready";

/** False in demo mode (no Supabase configured): the shop stays guest-only. */
export const authEnabled = Boolean(URL_ && KEY);

let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

/** The Supabase client, loading supabase-js the first time; null in demo mode. */
export function loadAuthClient(): Promise<SupabaseClient | null> {
  if (!authEnabled) return Promise.resolve(null);
  loading ??= import("@supabase/supabase-js").then(
    ({ createClient }) => {
      client = createClient(URL_!, KEY!, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: STORAGE_KEY },
      });
      window.dispatchEvent(new Event(READY));
      return client;
    },
    () => {
      // the download failed (network blip, or an old page after a deploy):
      // forget it so the next try downloads again, and say so plainly
      loading = null;
      throw new Error(NETWORK_ERROR);
    }
  );
  return loading;
}

/** True when the client should load now: a saved session, or auth tokens in the URL (reset link). */
function needsClientNow(): boolean {
  if (!authEnabled || typeof window === "undefined") return false;
  if (/(^|[#&?])(access_token|refresh_token|error_code|code)=/.test(location.hash + location.search)) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // storage blocked: can't tell, load it
  }
}

/**
 * Runs `cb` with the client once it exists: now if it's loaded or needed
 * (saved session), otherwise when something later loads it (signing in).
 * Returns a function that stops waiting.
 */
export function whenAuthClient(cb: (c: SupabaseClient) => void): () => void {
  if (!authEnabled) return () => {};
  if (client) {
    cb(client);
    return () => {};
  }
  let live = true;
  const run = () => live && client && cb(client);
  if (needsClientNow()) {
    loadAuthClient().then(run, () => {}); // offline: stays a guest until the next try
    return () => (live = false);
  }
  const onReady = () => {
    window.removeEventListener(READY, onReady);
    run();
  };
  window.addEventListener(READY, onReady);
  return () => {
    live = false;
    window.removeEventListener(READY, onReady);
  };
}

/** The signed-in session, or null. A guest gets null without loading supabase-js. */
export async function currentSession(): Promise<Session | null> {
  if (!client && !needsClientNow()) return null;
  const c = await loadAuthClient();
  return c ? (await c.auth.getSession()).data.session : null;
}

export function useShopper() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    let live = true;
    const stop = whenAuthClient((c) => {
      c.auth.getSession().then(({ data }) => {
        if (!live) return;
        setSession(data.session);
        setReady(true);
      });
      const { data } = c.auth.onAuthStateChange((_event, next) => live && setSession(next));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    // a guest: known straight away, nothing to load
    if (!client && !needsClientNow()) setReady(true);
    return () => {
      live = false;
      stop();
      unsubscribe();
    };
  }, []);

  return {
    enabled: authEnabled,
    ready,
    session,
    email: session?.user.email ?? null,
  };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const c = await loadAuthClient();
  if (!c) throw new Error("Sign-in is not available");
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) {
    const message = error?.message ?? "";
    throw new Error(
      /invalid login credentials/i.test(message)
        ? "Email or password is incorrect."
        : isNetworkError(message)
          ? NETWORK_ERROR
          : message || "Could not sign in."
    );
  }
  return data.session;
}

/** Shown instead of the browser's raw "Failed to fetch" when a request can't get through. */
export const NETWORK_ERROR =
  "We couldn't reach StickyPie — check your internet connection and try again.";

export function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message);
}

/**
 * Step 1 of "I'm new here". If the email already has an account and the
 * password is right, that's a returning shopper — they're simply signed in.
 * Otherwise a 6-digit code is emailed to prove they own the address.
 */
export async function startSignup(
  email: string,
  password: string
): Promise<{ session: Session } | { codeSent: true }> {
  try {
    return { session: await signIn(email, password) };
  } catch (err) {
    if (err instanceof Error && err.message === NETWORK_ERROR) throw err;
  }
  let res: Response;
  try {
    res = await fetch("/api/account/signup/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't send the code. Please try again.");
  return { codeSent: true };
}

/** Step 2: with the emailed code, creates the account and signs straight in. */
export async function finishSignup(email: string, password: string, name: string, code: string): Promise<Session> {
  let res: Response;
  try {
    res = await fetch("/api/account/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, code }),
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "exists") {
      throw new Error(
        "An account with this email already exists, but that password doesn't match — sign in or reset your password."
      );
    }
    throw new Error(typeof data.error === "string" ? data.error : "Could not create your account.");
  }
  return signIn(email, password);
}

export async function signOut(): Promise<void> {
  await (await loadAuthClient())?.auth.signOut();
}

/**
 * Emails a password-reset link that opens /account/reset. Supabase answers the
 * same way whether or not the account exists, so this never reveals which
 * emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const c = await loadAuthClient();
  if (!c) throw new Error("Password reset is not available");
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/account/reset`,
  });
  if (error) {
    if (isNetworkError(error.message)) throw new Error(NETWORK_ERROR);
    if (/security purposes/i.test(error.message)) {
      throw new Error(
        "We just sent you a reset email — check your inbox and spam folder. You can ask for another in a minute."
      );
    }
    if (/rate limit|too many/i.test(error.message)) {
      throw new Error("Too many reset emails were requested just now. Please try again in a few minutes.");
    }
    throw new Error(
      `We couldn't send the reset email right now. Please try again later or write to ${SUPPORT_EMAIL}.`
    );
  }
}

/** Sets a new password for the signed-in (or link-recovered) shopper. */
export async function updatePassword(password: string): Promise<void> {
  const c = await loadAuthClient();
  if (!c) throw new Error("Password reset is not available");
  const { error } = await c.auth.updateUser({ password });
  if (error) {
    throw new Error(
      /different from the old/i.test(error.message)
        ? "Choose a password you haven't used before."
        : error.message
    );
  }
}
