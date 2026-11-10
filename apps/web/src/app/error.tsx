"use client";

import { useEffect, useState } from "react";
import { reloadIfStaleBuild } from "@/lib/stale-build-script";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // an old saved page that can't load the new build's code: reload once instead
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (reloadIfStaleBuild(error.message)) setReloading(true);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-2xl font-semibold">{reloading ? "Updating the shop…" : "Something came unstuck"}</p>
      <p className="max-w-md text-sm text-fog">
        {reloading ? "One moment." : "This page hit a snag. Try again, or check your internet connection."}
      </p>
      {!reloading && (
        <button
          type="button"
          onClick={reset}
          className="peel-btn peel-btn--brand mt-2 rounded-xl px-6 py-2.5 text-sm font-semibold"
        >
          Try again
        </button>
      )}
    </div>
  );
}
