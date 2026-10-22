"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { markBackNavigation } from "@/lib/scroll-memory";
import { NAV_COUNT_KEY } from "./nav-tracker";

/**
 * Goes back to wherever the shopper came from (home hero, a row, browse) when
 * that page is in-app history; a direct or shared link falls back to /stickers
 * instead of leaving the site.
 */
export default function BackButton({ fallback = "/stickers" }: { fallback?: string }) {
  const router = useRouter();

  function goBack() {
    let visited = 0;
    try {
      visited = Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? "0");
    } catch {}
    // Came from a page of this site (in-app navigation, or a full page load
    // like a refresh whose referrer is this site) → real browser back, which
    // returns to the same place. A direct/shared link has nowhere to go back
    // to inside the shop, so it opens the category instead.
    let sameSiteReferrer = false;
    try {
      sameSiteReferrer = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    if ((visited > 1 || sameSiteReferrer) && window.history.length > 1) {
      markBackNavigation();
      router.back();
    }
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className="peel-btn peel-btn--light inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold"
    >
      <ArrowLeft className="size-4" strokeWidth={2.5} /> Back
    </button>
  );
}
