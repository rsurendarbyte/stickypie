// Client hooks for lite mode (see lite-script.ts for how it's decided).
import { useSyncExternalStore } from "react";

export { LITE_KEY } from "./lite-script";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lite"] });
  return () => observer.disconnect();
}

/** True when lite mode is on (always false on the server). */
export function useLite(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(document.documentElement.dataset.lite),
    () => false
  );
}

/** Slow network specifically (skip big downloads, not just effects). */
export function useSlowNetwork(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.lite === "net",
    () => false
  );
}
