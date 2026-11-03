"use client";

import { usePathname } from "next/navigation";

/** Pages shown without any shop look (header, footer, cart, background): the printer's job sheet. */
export function isBarePage(pathname: string | null): boolean {
  // /j/… is the same page on the neutral print address (infra/print-desk)
  return !!pathname && (pathname.startsWith("/print-job/") || pathname.startsWith("/j/"));
}

/** The shop's header, footer, cart bar and decorations — left out on bare pages. */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return isBarePage(usePathname()) ? null : <>{children}</>;
}
