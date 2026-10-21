"use client";

import { useState } from "react";
import { useProductReviews } from "@/lib/live-catalog";
import { Stars } from "./star-rating";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Small "★★★★½ 4.6 · 12 reviews" line near the price; links to the list. */
export function RatingSummary({ productId }: { productId: string }) {
  const { reviews, average } = useProductReviews(productId);
  if (reviews.length === 0) return null;
  return (
    <a href="#reviews" className="mt-1.5 inline-flex items-center gap-2 text-sm text-fog hover:text-snow">
      <Stars value={average} size={15} />
      <span className="font-semibold text-snow">{average.toFixed(1)}</span>
      <span>
        · {reviews.length} review{reviews.length === 1 ? "" : "s"}
      </span>
    </a>
  );
}

/** Approved shopper reviews for a sticker. */
export default function ProductReviews({ productId }: { productId: string }) {
  const { reviews, average, loaded } = useProductReviews(productId);
  const [showAll, setShowAll] = useState(false);
  // Nothing to show until a review is approved — no empty block.
  if (!loaded || reviews.length === 0) return null;

  const counts = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.rating === n).length);
  const shown = showAll ? reviews : reviews.slice(0, 4);

  return (
    <section id="reviews" className="mt-12 scroll-mt-24">
      <h2 className="font-display text-xl font-bold">Customer reviews</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="rounded-2xl border border-line bg-ink2 p-5">
            <p className="font-display text-4xl font-bold">{average.toFixed(1)}</p>
            <Stars value={average} size={18} className="mt-1" />
            <p className="mt-1 text-xs text-fog">
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n, i) => (
                <li key={n} className="flex items-center gap-2 text-xs text-fog">
                  <span className="w-3 text-right">{n}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${(counts[i] / reviews.length) * 100}%` }}
                    />
                  </span>
                  <span className="w-5 text-right">{counts[i]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ul className="space-y-3">
              {shown.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line bg-ink p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={15} />
                    <span className="text-sm font-semibold">{r.authorName}</span>
                    <span className="text-xs text-fog">· Verified buyer · {fmtDate(r.createdAt)}</span>
                  </div>
                  {r.body && <p className="mt-2 text-sm leading-relaxed text-snow/85">{r.body}</p>}
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                      <img
                        src={r.photoUrl}
                        alt={`Photo from ${r.authorName}`}
                        loading="lazy"
                        decoding="async"
                        className="h-28 w-auto max-w-[200px] rounded-xl border border-line object-cover transition-transform hover:scale-[1.02]"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {reviews.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 text-sm font-semibold text-brand hover:underline"
              >
                {showAll ? "Show fewer" : `Show all ${reviews.length} reviews`}
              </button>
            )}
          </div>
        </div>
    </section>
  );
}
