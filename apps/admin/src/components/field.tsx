"use client";

// Material-style form controls: filled fields with floating labels, themed
// selects and checkboxes. Shared look for every input in the storefront.
import { Check, ChevronDown } from "lucide-react";

function shell(error?: string): string {
  return `relative block rounded-xl border bg-ink2/70 transition-all duration-200 ${
    error
      ? "border-brand/70 shadow-[0_0_0_3px_rgba(255,46,99,0.14)]"
      : "border-line hover:border-fog/40 focus-within:border-brand/70 focus-within:shadow-[0_0_0_3px_rgba(255,46,99,0.14)]"
  }`;
}

const FLOAT_LABEL =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-fog transition-all duration-150 " +
  "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[10.5px] peer-focus:font-semibold peer-focus:tracking-widest peer-focus:uppercase peer-focus:text-brand " +
  "peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10.5px] peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:uppercase";

const STATIC_LABEL =
  "pointer-events-none absolute left-4 top-3 text-[10.5px] font-semibold tracking-widest text-fog uppercase";

function Message({ error, hint }: { error?: string; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <span className={`mt-1.5 block text-xs ${error ? "text-brand" : "text-fog/70"}`}>
      {error ?? hint}
    </span>
  );
}

export function TextField({
  label,
  error,
  hint,
  className = "",
  ...rest
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className={shell(error)}>
        <input
          {...rest}
          placeholder=" "
          className="peer h-14 w-full bg-transparent px-4 pt-4 pb-0.5 text-sm text-snow outline-none placeholder-transparent"
        />
        <span className={FLOAT_LABEL}>{label}</span>
      </span>
      <Message error={error} hint={hint} />
    </label>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className = "",
  rows = 3,
  ...rest
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className={shell(error)}>
        <textarea
          {...rest}
          rows={rows}
          placeholder=" "
          className="peer w-full resize-none bg-transparent px-4 pt-7 pb-3 text-sm text-snow outline-none placeholder-transparent"
        />
        <span className={STATIC_LABEL}>{label}</span>
      </span>
      <Message error={error} hint={hint} />
    </label>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className = "",
  children,
  ...rest
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className}`}>
      <span className={shell(error)}>
        <select
          {...rest}
          className="peer h-14 w-full cursor-pointer appearance-none bg-transparent px-4 pt-4 pb-0.5 pr-10 text-sm text-snow outline-none"
        >
          {children}
        </select>
        <span className={STATIC_LABEL}>{label}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-fog transition-transform duration-200 peer-focus:rotate-180 peer-focus:text-brand" />
      </span>
      <Message error={error} hint={hint} />
    </label>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  className = "",
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 text-sm text-snow select-none ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="grid size-5 shrink-0 place-items-center rounded-md border border-line bg-ink2 text-white transition-all duration-150 peer-checked:border-transparent peer-checked:bg-[linear-gradient(135deg,#ff2e63,#ff7a3c)] peer-checked:shadow-[0_2px_10px_rgba(255,46,99,0.35)] peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 [&>svg]:scale-0 [&>svg]:transition-transform [&>svg]:duration-150 peer-checked:[&>svg]:scale-100">
        <Check className="size-3.5" strokeWidth={3.5} />
      </span>
      <span>{label}</span>
    </label>
  );
}
