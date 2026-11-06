"use client";

import { useEffect } from "react";
import { recordVisitor } from "@/lib/live-catalog";

/** Counts this browser once a day for the admin's Unique visitors number. */
export default function VisitorCount() {
  useEffect(() => recordVisitor(), []);
  return null;
}
