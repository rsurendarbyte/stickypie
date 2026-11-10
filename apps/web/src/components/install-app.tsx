"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";

// Asks phone shoppers to install the shop as an app (a PWA, public/sw.js +
// manifest). Android/Chrome: our card, then the browser's own install dialog.
// iPhone/iPad Safari has no install dialog, so the card shows the two taps.
// A small card above the tab bar, never a blocking sheet. Only on the home
// page, never in the swipe view or on a poster page, and not for a visit that
// came from an ad (a link with ad tracking, or one that landed on a poster):
// those shoppers came to buy. Never inside the installed app; × keeps it away
// for a few days.

const KEY = "stickypie.install.later";
const LATER_DAYS = 3;
/** Shown this long after the page opens, once the shopper has seen the shop. */
const DELAY_MS = 4000;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function installed(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

const LANDING = "stickypie.install.landing";

/** The visit's first page came from an ad, or opened straight on a poster. */
function adVisit(): boolean {
  try {
    let landing = sessionStorage.getItem(LANDING);
    if (landing === null) {
      const q = new URLSearchParams(location.search);
      const ad = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "utm_source", "utm_medium", "utm_campaign"].some((k) => q.has(k));
      landing = ad || location.pathname !== "/" ? "ad" : "home";
      sessionStorage.setItem(LANDING, landing);
    }
    return landing === "ad";
  } catch {
    return true;
  }
}

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(KEY)) > Date.now();
  } catch {
    return false;
  }
}

export default function InstallApp() {
  const pathname = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  // the app is installed but this is a browser tab (links from other apps open the app itself)
  const [hasApp, setHasApp] = useState(false);
  const home = pathname === "/";
  // ?install on the home page shows the card regardless (to check it, desktop too)
  const [forced, setForced] = useState(false);

  // the app's service worker (needed for "install"); harmless if it fails
  useEffect(() => {
    adVisit(); // remembers where this visit started
    if (!("serviceWorker" in navigator)) return;
    // never on the local dev server: its code files change without changing name,
    // so the worker's saved copies would go stale (and an old one is removed)
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister()), () => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (installed()) return;
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    nav.getInstalledRelatedApps?.().then((apps) => setHasApp(apps.length > 0), () => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setOpen(false);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua));
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // home page on phones only, a few seconds in, when it can actually be installed
  useEffect(() => {
    if (!home) {
      setOpen(false);
      return;
    }
    if (new URLSearchParams(location.search).has("install")) {
      setForced(true);
      setOpen(true);
      return;
    }
    if (hasApp || installed() || snoozed() || adVisit() || !(event || ios)) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const t = window.setTimeout(() => {
      // still on the home page (the swipe view moves the address to a poster),
      // and not over the swipe view, a game or another pop-up
      if (location.pathname !== "/") return;
      if (!document.querySelector('.swipe-view-root, [aria-label^="Puzzle:"], [role="dialog"]')) setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [event, ios, home, hasApp]);

  // hides itself if the swipe view or a game opens over the home page
  useEffect(() => {
    if (!open) return;
    const check = () => {
      if (location.pathname !== "/" || document.querySelector('.swipe-view-root, [aria-label^="Puzzle:"]')) setOpen(false);
    };
    const id = window.setInterval(check, 800);
    return () => window.clearInterval(id);
  }, [open]);

  function later() {
    try {
      localStorage.setItem(KEY, String(Date.now() + LATER_DAYS * 86_400_000));
    } catch {
      // still closes for this visit
    }
    setOpen(false);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") setOpen(false);
    else later();
  }

  if (!open) return null;
  return (
    // no backdrop: the page behind keeps scrolling and tapping
    <div
      role="complementary"
      aria-labelledby="install-app-title"
      className={`puzzle-win-up fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[60] rounded-full border border-line bg-white py-1 pr-1 pl-1.5 shadow-lg ${forced ? "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80" : "sm:hidden"}`}
    >
      {/* one slim row: icon, short line, Install (iPhone: the two taps), × */}
      <div className="flex items-center gap-2">
        <img src="/icons/icon-192.png" alt="" className="size-7 shrink-0 rounded-lg" />
        {event ? (
          <p id="install-app-title" className="min-w-0 flex-1 truncate text-[13px] font-bold">
            Get the app
          </p>
        ) : (
          <p id="install-app-title" className="flex min-w-0 flex-1 items-center gap-1 truncate text-xs">
            Tap <Share className="size-3.5 shrink-0 text-[#007aff]" /> then <SquarePlus className="size-3.5 shrink-0" /> <b className="truncate">Add to Home Screen</b>
          </p>
        )}
        {event && (
          <button type="button" onClick={install} className="peel-btn inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold">
            <Download className="peel-icon size-3.5" /> Install
          </button>
        )}
        <button type="button" onClick={later} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded-full text-fog">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
