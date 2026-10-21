"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const WORDS = ["", "Not great", "Okay", "Good", "Really good", "Love it!"];

/** Read-only stars (supports halves for averages). */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-gold" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** 1–5 star picker with hover preview and a word for the choice. */
export default function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Your rating" className="flex" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onPointerEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform active:scale-90"
          >
            <Star
              className={`size-7 transition-colors ${n <= shown ? "text-gold" : "text-line"}`}
              fill="currentColor"
              strokeWidth={0}
            />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-fog">{WORDS[shown]}</span>
    </div>
  );
}
