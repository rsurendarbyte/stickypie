"use client";

import { useState } from "react";
import { MAX_STICKER_INCHES, MIN_STICKER_INCHES, STICKER_SIZES } from "@stickypie/shared";
import { TextField } from "./field";

const digits = (v: string) => v.replace(/\D/g, "");

/** Usual sizes plus any extra, sorted, as editable strings. */
export function priceRows(prices: Record<string, number>): Record<string, string> {
  return Object.fromEntries(
    [...new Set<number>([...STICKER_SIZES, ...Object.keys(prices).map(Number)])]
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
      .map((n) => [String(n), String(prices[String(n)] ?? 0)])
  );
}

export function rowsToPrices(rows: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(rows).map(([size, price]) => [size, Number(price) || 0]));
}

/** Price per size (₹) with "Add a size" — used for custom and QR stickers. */
export default function SizePriceList({
  value,
  onChange,
  unit,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** e.g. "custom" → "3″ custom (₹)". */
  unit: string;
}) {
  const [newSize, setNewSize] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addSize() {
    const inches = Number(newSize);
    if (!Number.isInteger(inches) || inches < MIN_STICKER_INCHES || inches > MAX_STICKER_INCHES) {
      setError(`Enter a whole number from ${MIN_STICKER_INCHES} to ${MAX_STICKER_INCHES}`);
      return;
    }
    if (String(inches) in value) {
      setError(`${inches} inch is already in the list`);
      return;
    }
    onChange(Object.fromEntries([...Object.entries(value), [String(inches), ""]].sort((a, b) => Number(a[0]) - Number(b[0]))));
    setNewSize("");
    setError(null);
  }

  return (
    <>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {Object.keys(value).map((size) => (
          <div key={size}>
            <TextField
              label={`${size}″ ${unit} (₹)`}
              value={value[size]}
              onChange={(e) => onChange({ ...value, [size]: digits(e.target.value) })}
              inputMode="numeric"
            />
            {!(STICKER_SIZES as readonly number[]).includes(Number(size)) && (
              <button
                type="button"
                onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([k]) => k !== size)))}
                className="mt-1 text-xs font-semibold text-fog hover:text-brand"
              >
                Remove {size} inch
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <TextField
          label="Add a size (inch)"
          value={newSize}
          onChange={(e) => {
            setNewSize(digits(e.target.value).slice(0, 2));
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSize();
            }
          }}
          inputMode="numeric"
          error={error ?? undefined}
          hint={`Any whole inch, ${MIN_STICKER_INCHES}–${MAX_STICKER_INCHES}`}
          className="w-56"
        />
        <button
          type="button"
          onClick={addSize}
          className="h-14 rounded-xl border border-line px-4 text-sm font-semibold transition-colors hover:border-brand/60 hover:text-brand"
        >
          + Add size
        </button>
      </div>
    </>
  );
}
