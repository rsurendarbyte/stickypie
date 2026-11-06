"use client";

import { AlertTriangle, Check } from "lucide-react";
import type { PosterSend } from "@/lib/own-posters";
import LabelModal from "./label-modal";
import StickerLoader from "./sticker-loader";

const noop = () => {};

/**
 * The shopper's own posters going up after they press Pay: one row each with its
 * percentage. Only a failed list can be closed, so nobody leaves one half sent.
 */
export default function OwnPosterSend({ rows, onRetry, onClose }: { rows: PosterSend[] | null; onRetry: () => void; onClose: () => void }) {
  const failed = rows?.some((row) => row.failed);
  const done = rows?.filter((row) => row.percent === 100).length ?? 0;
  const total = rows?.length ?? 0;
  return (
    <LabelModal open={Boolean(rows)} onClose={failed ? onClose : noop} labelledBy="own-send-title" className="max-w-sm p-4">
      <h2 id="own-send-title" className="flex items-center gap-2 font-display text-lg font-bold">
        {failed ? <AlertTriangle className="size-5 shrink-0 text-gold" /> : <StickerLoader size={20} />}
        {failed ? "A poster didn't go through" : total === 1 ? "Sending your poster" : `Sending your posters · ${done} of ${total}`}
      </h2>
      <p className="mt-0.5 text-xs text-fog">{failed ? "You haven't been charged." : "Keep this page open. Payment comes next."}</p>
      <ul className="mt-3 max-h-[50dvh] space-y-2.5 overflow-y-auto">
        {rows?.map((row, i) => (
          <li key={row.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {row.thumb ? <img src={row.thumb} alt="" className="aspect-[2/3] w-9 shrink-0 rounded-sm object-cover" /> : <span className="aspect-[2/3] w-9 shrink-0 rounded-sm bg-panel" />}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">Your poster {i + 1}</span>
                <span className={`flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums ${row.failed ? "text-brand" : row.percent === 100 ? "text-mint" : "text-snow"}`}>
                  {row.percent === 100 && <Check className="size-3.5" strokeWidth={3} />}
                  {row.failed ? "Failed" : `${row.percent}%`}
                </span>
              </span>
              <span className="block truncate text-[11px] text-fog">{row.failed ?? row.wall}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-snow/10">
                <span className={`block h-full rounded-full transition-[width] duration-200 ${row.failed ? "bg-brand" : "pie-gradient"}`} style={{ width: `${row.percent}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      {failed && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="peel-btn peel-btn--light h-11 flex-1 rounded-full text-sm font-bold">
            Close
          </button>
          <button type="button" onClick={onRetry} className="peel-btn peel-btn--brand h-11 flex-1 rounded-full text-sm font-bold">
            Try again
          </button>
        </div>
      )}
    </LabelModal>
  );
}
