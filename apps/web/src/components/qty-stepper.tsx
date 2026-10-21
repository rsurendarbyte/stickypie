"use client";

import { Minus, Plus } from "lucide-react";

// Quantity stepper with raised, obviously-pressable − / + keys.
export default function QtyStepper({
  value,
  onChange,
  max,
  compact = false,
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number | null;
  compact?: boolean;
}) {
  const limit = max === null || max === undefined ? 99 : Math.min(max, 99);
  const key = `${compact ? "size-7" : "size-8"} grid place-items-center rounded-lg border border-line bg-ink text-snow shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition-all hover:border-brand/50 hover:text-brand active:scale-95 disabled:pointer-events-none disabled:opacity-35`;
  const label = compact ? "w-7 text-sm" : "w-9 text-base";

  return (
    <div
      className={`inline-flex items-center rounded-xl border border-line bg-ink2 ${compact ? "p-0.5" : "p-1"}`}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className={key}
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className={`${label} text-center font-bold tabular-nums`}>{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(limit, value + 1))}
        disabled={value >= limit}
        className={key}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
