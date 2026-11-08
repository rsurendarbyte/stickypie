"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

/** Guest orders: the private link that opens this order on any phone. */
export default function GuestOrderLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My StickyPie order", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // share sheet closed, or no clipboard: the link is on screen to copy by hand
    }
  }

  return (
    <section className="mx-auto mb-6 max-w-xl rounded-2xl border border-line bg-panel/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Link2 className="size-4 text-brand" /> Save your order link
      </p>
      <p className="mt-1 text-xs text-fog">
        You ordered without an account. This page opens on this phone, and anywhere else with this link, so keep
        it to track your order.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-lg bg-ink/40 px-3 py-2 text-xs text-fog select-all">
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          className="peel-btn peel-btn--light inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Save link"}
        </button>
      </div>
    </section>
  );
}
