"use client";

import { useState } from "react";
import { FEATURES, PUZZLE_PERCENT_MAX, type FeatureFlags, type FeatureKey } from "@stickypie/shared";
import { useToast } from "./toast";

export default function FeatureToggles({ initial, puzzlePercent }: { initial: FeatureFlags; puzzlePercent: number }) {
  const [flags, setFlags] = useState(initial);
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const { toast } = useToast();

  async function toggle(key: FeatureKey) {
    const before = flags;
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setSaving(key);
    const res = await fetch("/api/features", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(null);
    if (!res.ok) {
      setFlags(before);
      const data = await res.json().catch(() => ({}));
      toast(typeof data.error === "string" ? data.error : "Could not save", "error");
      return;
    }
    toast(`${FEATURES[key].label}: ${next[key] ? "on" : "off"}`);
  }

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-ink2">
      {(Object.keys(FEATURES) as FeatureKey[]).map((key) => (
        <div key={key} className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="min-w-0">
            <p className="font-medium">{FEATURES[key].label}</p>
            <p className="mt-0.5 text-sm text-fog">{FEATURES[key].description}</p>
            {key === "posterPuzzle" && <PuzzlePercent initial={puzzlePercent} />}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={flags[key]}
            aria-label={FEATURES[key].label}
            disabled={saving === key}
            onClick={() => toggle(key)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              flags[key] ? "pie-gradient" : "bg-panel"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                flags[key] ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

/** The puzzle prize's percent off: every "Win N% OFF" in the shop, the cart and checkout use it. */
function PuzzlePercent({ initial }: { initial: number }) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= PUZZLE_PERCENT_MAX;

  async function save() {
    setSaving(true);
    const res = await fetch("/api/features/puzzle-percent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percent: n }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(typeof data.error === "string" ? data.error : "Could not save", "error");
    setSaved(data.percent);
    toast(`Puzzle prize: ${data.percent}% off`);
  }

  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && n !== saved) save();
      }}
    >
      <label htmlFor="puzzle-percent" className="text-sm font-medium">
        Prize
      </label>
      <div className="flex items-center rounded-lg border border-line bg-panel pr-2.5">
        <input
          id="puzzle-percent"
          type="number"
          inputMode="numeric"
          min={1}
          max={PUZZLE_PERCENT_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-16 bg-transparent px-2.5 text-sm tabular-nums outline-none"
        />
        <span className="text-sm text-fog">% off</span>
      </div>
      <button
        type="submit"
        disabled={!valid || n === saved || saving}
        className="h-9 rounded-lg bg-snow px-3.5 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
