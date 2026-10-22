"use client";

import { useSyncExternalStore } from "react";

// One random number per page load. The server (and the first hydration pass)
// uses 0, then the client switches to its own value — no hydration mismatch.
const clientSeed = typeof window === "undefined" ? 0 : Math.floor(Math.random() * 1_000_000) + 1;
const noop = () => () => {};

/** Random per page load; stays the same while the visitor browses. */
export function useSkinSeed(): number {
  return useSyncExternalStore(noop, () => clientSeed, () => 0);
}
