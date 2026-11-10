"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { whenAuthClient } from "@/lib/shopper-auth";

/** Fired on window once guest orders moved onto the signed-in account. */
export const ORDERS_CLAIMED = "sp:orders-claimed";

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
 * Once a visit per account: guest orders placed with its email join it
 * (the server checks the email is confirmed).
 */
async function claimGuestOrders(session: Session): Promise<number> {
  const key = `sp_claimed:${session.user.id}`;
  try {
    if (sessionStorage.getItem(key)) return 0;
    sessionStorage.setItem(key, "1");
  } catch {
    // private mode: ask anyway
  }
  const res = await fetch("/api/account/claim-orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  return typeof data?.claimed === "number" ? data.claimed : 0;
}

/**
 * Keeps the cookie in step with the browser session (sign in, token refresh,
 * sign out), so server pages like an order know who is looking. A guest who
 * signs in finds their guest orders on the account.
 */
export default function AuthCookieSync() {
  const router = useRouter();
  useEffect(() => {
    let unsubscribe = () => {};
    const sync = (session: Session | null) => {
      writeAuthCookie(session?.access_token ?? null, session?.expires_at);
      if (!session) return;
      void claimGuestOrders(session).then((claimed) => {
        if (!claimed) return;
        window.dispatchEvent(new Event(ORDERS_CLAIMED));
        router.refresh();
      });
    };
    // A guest never loads supabase-js; this starts once a session exists or they sign in.
    const stop = whenAuthClient((c) => {
      c.auth.getSession().then(({ data }) => sync(data.session));
      const { data } = c.auth.onAuthStateChange((_event, session) => sync(session));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, [router]);
  return null;
}
