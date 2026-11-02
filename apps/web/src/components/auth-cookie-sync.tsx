"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/shopper-auth";

/** Must match SHOPPER_COOKIE in lib/shopper.ts (server-only file). */
const COOKIE = "sp_at";

/** Writes (or clears) the cookie copy of the shopper's access token. */
export function writeAuthCookie(token: string | null, expiresAt?: number) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  if (!token) {
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
    return;
  }
  const maxAge = expiresAt ? Math.max(60, expiresAt - Math.floor(Date.now() / 1000)) : 3600;
  document.cookie = `${COOKIE}=${token}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

/**
 * Keeps the cookie in step with the browser session (sign in, token refresh,
 * sign out), so server pages like an order know who is looking.
 */
export default function AuthCookieSync() {
  useEffect(() => {
    const c = authClient();
    if (!c) return;
    c.auth.getSession().then(({ data }) =>
      writeAuthCookie(data.session?.access_token ?? null, data.session?.expires_at)
    );
    const { data } = c.auth.onAuthStateChange((_event, session) =>
      writeAuthCookie(session?.access_token ?? null, session?.expires_at)
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
