"use client";

import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { formatINR } from "@stickypie/shared";

/**
 * Phones: total + Add / Book now pinned to the bottom of the custom sticker
 * makers, so booking is always one tap away while the shopper scrolls the
 * options. The cart strip steps aside on these pages on phones, so this is the
 * only bar at the bottom. Hidden from sm up, where the inline buttons show.
 */
export default function CustomBookBar({
  total,
  summary,
  hint,
  busy,
  onAdd,
  onBook,
}: {
  total: number;
  /** e.g. "2 × 3″ name sticker" */
  summary: string;
  /** What's still missing (e.g. "Type your name first"); shown instead of the summary. */
  hint?: string | null;
  busy: boolean;
  onAdd: () => void;
  onBook: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.18)] backdrop-blur-md sm:hidden">
      <div className="flex items-center gap-2">
        <span className="mr-auto min-w-0">
          <span className={`block truncate text-[11px] ${hint ? "font-semibold text-brand" : "text-fog"}`}>
            {hint || summary}
          </span>
          <span className="block font-display text-xl leading-tight font-bold">{formatINR(total)}</span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onAdd}
          aria-label="Add to cart"
          className="peel-btn peel-btn--light grid size-11 shrink-0 place-items-center rounded-xl"
        >
          <ShoppingBag className="size-5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onBook}
          className="peel-btn peel-btn--brand flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Book now <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
