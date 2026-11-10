"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordVisitor } from "@/lib/live-catalog";
import { journeyPage } from "@/lib/journey";

/**
 * Counts this browser once a day for the admin's Unique visitors number, and
 * notes each page for the admin's Journeys page (path only).
 */
export default function VisitorCount() {
  const pathname = usePathname();
  useEffect(() => recordVisitor(), []);
  useEffect(() => journeyPage(pathname), [pathname]);
  return null;
}
