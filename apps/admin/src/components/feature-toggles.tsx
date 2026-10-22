"use client";

import { useState } from "react";
import { FEATURES, type FeatureFlags, type FeatureKey } from "@stickypie/shared";
import { useToast } from "./toast";

export default function FeatureToggles({ initial }: { initial: FeatureFlags }) {
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
