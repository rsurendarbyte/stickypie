"use client";

import { Frame, Puzzle, Sticker } from "lucide-react";
import type { PosterFinish } from "@stickypie/shared";
import { useFeatures } from "@/lib/live-catalog";
import { setFinish, useFinish } from "@/lib/poster-finish";

const OPTIONS: { id: PosterFinish; icon: typeof Frame; label: string; detail: string }[] = [
  { id: "poster", icon: Frame, label: "Wall poster", detail: "Premium paper, glue dots included" },
  { id: "sticker", icon: Sticker, label: "Sticker", detail: "Vinyl, peel & stick" },
  { id: "puzzle", icon: Puzzle, label: "Puzzle", detail: "9 cards build one big poster" },
];

/**
 * Mini posters: wall poster or sticker. `compact` is a small two-way switch for
 * the phone buy bar, so it shares one row with the sizes.
 */
export default function FinishPicker({ compact = false }: { compact?: boolean }) {
  const finish = useFinish();
  const features = useFeatures();
  const options = OPTIONS.filter((o) => o.id !== "puzzle" || features.posterPuzzle);
  if (compact) {
    return (
      <div role="radiogroup" aria-label="Wall poster, sticker or puzzle" className="flex shrink-0 rounded-xl bg-white/60 p-0.5 ring-1 ring-line">
        {options.map(({ id, icon: Icon, label }) => {
          const on = id === finish;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              onClick={() => setFinish(id)}
              className={`flex h-9 items-center gap-1 rounded-[10px] px-2 text-[13px] font-bold transition-colors ${
                on ? "bg-white text-brand shadow-sm ring-1 ring-brand/40" : "text-fog"
              }`}
            >
              <Icon className="size-3.5 shrink-0" /> {id === "poster" ? "Poster" : label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="Wall poster, sticker or puzzle" className={`grid max-w-md gap-2 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map(({ id, icon: Icon, label, detail }) => {
        const on = id === finish;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setFinish(id)}
            className={`relative rounded-xl border px-3 py-2 text-left transition-colors ${
              on ? "border-brand bg-brand/[0.07] ring-1 ring-brand" : "border-line bg-white"
            }`}
          >
            {id === "puzzle" && !on && (
              <span className="puzzle-cta absolute -top-2 right-2 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wider text-white uppercase">New</span>
            )}
            <span className={`flex items-center gap-1.5 font-display text-sm font-bold ${on ? "text-brand" : "text-snow"}`}>
              <Icon className="size-4 shrink-0" /> {label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-fog">{detail}</span>
          </button>
        );
      })}
    </div>
  );
}
