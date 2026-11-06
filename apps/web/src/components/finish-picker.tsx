"use client";

import { Frame, Sticker } from "lucide-react";
import type { PosterFinish } from "@stickypie/shared";
import { setFinish, useFinish } from "@/lib/poster-finish";

const OPTIONS: { id: PosterFinish; icon: typeof Frame; label: string; detail: string }[] = [
  { id: "poster", icon: Frame, label: "Wall poster", detail: "270 GSM, glue dots included" },
  { id: "sticker", icon: Sticker, label: "Sticker", detail: "Vinyl, peel & stick" },
];

/** Mini posters: wall poster or sticker. `compact` drops the detail line for the phone buy bar. */
export default function FinishPicker({ compact = false }: { compact?: boolean }) {
  const finish = useFinish();
  return (
    <div role="radiogroup" aria-label="Wall poster or sticker" className="grid max-w-md grid-cols-2 gap-2">
      {OPTIONS.map(({ id, icon: Icon, label, detail }) => {
        const on = id === finish;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setFinish(id)}
            className={`rounded-xl border text-left transition-colors ${compact ? "px-2.5 py-1.5" : "px-3 py-2"} ${
              on ? "border-brand bg-brand/[0.07] ring-1 ring-brand" : "border-line bg-white"
            }`}
          >
            <span className={`flex items-center gap-1.5 font-display text-sm font-bold ${on ? "text-brand" : "text-snow"}`}>
              <Icon className="size-4 shrink-0" /> {label}
            </span>
            {!compact && <span className="mt-0.5 block text-[11px] leading-tight text-fog">{detail}</span>}
          </button>
        );
      })}
    </div>
  );
}
