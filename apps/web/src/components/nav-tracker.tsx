"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_COUNT_KEY = "stickypie.navCount";
const LAST_PATH_KEY = "stickypie.lastPath";

/**
 * Counts in-app route changes for this tab, so Back controls can tell a real
 * in-app history entry from a direct/shared link (where browser back would
 * leave the site). The last-path guard keeps StrictMode re-runs and reloads
 * from inflating the count.
 */
export default function NavTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(LAST_PATH_KEY) === pathname) return;
      sessionStorage.setItem(LAST_PATH_KEY, pathname);
      const n = Number(sessionStorage.getItem(NAV_COUNT_KEY) ?? "0");
      sessionStorage.setItem(NAV_COUNT_KEY, String(n + 1));
    } catch {
      // storage unavailable — Back falls back to /browse
    }
  }, [pathname]);

  return null;
}
