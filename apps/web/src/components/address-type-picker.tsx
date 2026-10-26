"use client";

import { Briefcase, Home, MapPin } from "lucide-react";
import { ADDRESS_TYPES, type AddressType } from "@/lib/addresses";

export const ADDRESS_TYPE_ICON = { Home, Work: Briefcase, Other: MapPin } as const;

/** Home / Work / Other chips for an address. */
export default function AddressTypePicker({
  value,
  onChange,
  className = "",
}: {
  value: AddressType;
  onChange: (type: AddressType) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10.5px] font-semibold tracking-widest text-fog uppercase">Address type</p>
      <div role="radiogroup" aria-label="Address type" className="mt-1.5 flex flex-wrap gap-2">
        {ADDRESS_TYPES.map((type) => {
          const Icon = ADDRESS_TYPE_ICON[type];
          const active = type === value;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "border-brand bg-brand/[0.06] text-brand ring-1 ring-brand"
                  : "border-line bg-ink text-fog hover:border-snow/30 hover:text-snow"
              }`}
            >
              <Icon className="size-3.5" /> {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small badge used on saved-address cards. */
export function AddressTypeBadge({ type }: { type: AddressType }) {
  const Icon = ADDRESS_TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1 rounded bg-panel px-1.5 py-0.5 text-[10px] font-bold text-fog uppercase">
      <Icon className="size-3" /> {type}
    </span>
  );
}
