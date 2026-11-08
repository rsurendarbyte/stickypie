"use client";

import Link from "@/components/page-link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { signOut, useShopper } from "@/lib/shopper-auth";
import { writeAuthCookie } from "./auth-cookie-sync";
import StickerLoader from "./sticker-loader";

/**
 * Shown instead of an order (or invoice) the server couldn't match to the
 * viewer. Signed in here already → refresh the cookie and reload once; else
 * ask them to sign in with the account that placed it. A guest order has no
 * account: it opens from the browser that placed it, or its order link.
 */
export default function OrderSignIn({ path, code, guest = false }: { path: string; code: string; guest?: boolean }) {
  const shopper = useShopper();
  const router = useRouter();
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (guest || !shopper.ready || !shopper.session) return;
    // One retry per page: the cookie may simply have been missing or stale.
    const key = `order-retry:${path}`;
    let tried = false;
    try {
      tried = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode: retry anyway, the flag just isn't remembered
    }
    if (tried) {
      setRetried(true);
      return;
    }
    writeAuthCookie(shopper.session.access_token, shopper.session.expires_at);
    router.refresh();
  }, [shopper.ready, shopper.session, path, router]);

  if (guest) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-sm flex-col items-center justify-center px-4 pt-20 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand/10">
          <Lock className="size-7 text-brand" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Order {code}</h1>
        <p className="mt-1 text-sm text-fog">
          This order was placed without an account. Open it on the phone or browser you ordered from, or with
          the order link you saved. Lost it? Contact us with the code {code}.
        </p>
        <Link
          href="/contact"
          className="peel-btn mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
        >
          Contact us
        </Link>
      </div>
    );
  }

  if (!shopper.ready || (shopper.session && !retried)) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <StickerLoader size={48} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-sm flex-col items-center justify-center px-4 pt-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand/10">
        <Lock className="size-7 text-brand" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold">Order {code}</h1>
      {shopper.session ? (
        <>
          <p className="mt-1 text-sm text-fog">
            This order isn&apos;t on the account you&apos;re signed in with ({shopper.email}). Sign in with the
            account that placed it.
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              writeAuthCookie(null);
              router.push(`/account?next=${encodeURIComponent(path)}`);
            }}
            className="peel-btn mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
          >
            Switch account
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-fog">Sign in with the account that placed this order to see it.</p>
          <Link
            href={`/account?next=${encodeURIComponent(path)}`}
            className="peel-btn mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold"
          >
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}
