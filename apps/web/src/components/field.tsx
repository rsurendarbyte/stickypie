"use client";

// Material-style form controls: filled fields with floating labels, themed
// selects and checkboxes. Shared look for every input in the storefront.
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";

function shell(error?: string): string {
  return `relative block rounded-xl border bg-ink2/70 transition-all duration-200 ${
    error
      ? "border-brand/70 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand)_14%,transparent)]"
      : "border-line hover:border-fog/40 focus-within:border-brand/70 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand)_14%,transparent)]"
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
  trailing,
  ...rest
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Control shown inside the field on the right (e.g. a show-password toggle). */
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className={shell(error)}>
        <input
          {...rest}
          placeholder=" "
          className={`peer h-14 w-full bg-transparent px-4 pt-4 pb-0.5 text-sm text-snow outline-none placeholder-transparent ${
            trailing ? "pr-12" : ""
          }`}
        />
        <span className={FLOAT_LABEL}>{label}</span>
        {trailing && <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>}
      </span>
      <Message error={error} hint={hint} />
    </label>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<React.ComponentProps<typeof TextField>, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="grid size-9 place-items-center rounded-lg text-fog transition-colors hover:bg-snow/5 hover:text-snow"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
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

type Option = { value: string; label: string; disabled: boolean };

function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    const label = Children.toArray(props.children).join("");
    out.push({ value: String(props.value ?? label), label, disabled: Boolean(props.disabled) });
  });
  return out;
}

/**
 * Premium dropdown with the same API as a native <select> (label, value,
 * onChange(e) with e.target.value, <option> children). Floating panel with a
 * checkmark on the chosen item, full keyboard support, type-to-jump, and a
 * search box for long lists (e.g. states).
 */
export function SelectField({
  label,
  error,
  hint,
  className = "",
  children,
  value,
  onChange,
  disabled,
  id,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  value?: string | number | readonly string[];
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  disabled?: boolean;
  id?: string;
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const current = String(value ?? "");
  const selected = options.find((o) => o.value === current && !o.disabled) ?? null;
  const placeholder = options.find((o) => o.value === current)?.label ?? options.find((o) => o.disabled)?.label ?? "Select";
  const choices = options.filter((o) => !o.disabled);
  const searchable = choices.length > 10;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? choices.filter((o) => o.label.toLowerCase().includes(q)) : choices;
  }, [choices, query]);

  function openList() {
    if (disabled) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom);
    setQuery("");
    setActive(Math.max(0, choices.findIndex((o) => o.value === current)));
    setOpen(true);
  }

  function choose(option: Option) {
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== current) onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } });
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Focus the search box / keep the active row in view.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(visible.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (!searchable && e.key.length === 1) {
      // Type-to-jump for short lists.
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at < 600 ? t.text + e.key.toLowerCase() : e.key.toLowerCase();
      t.at = now;
      const hit = visible.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={rootRef} className={`relative block ${className}`} onKeyDown={onKey}>
      <span className={shell(error)}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${label}: ${selected?.label ?? placeholder}`}
          onClick={() => (open ? setOpen(false) : openList())}
          className="flex h-14 w-full items-end px-4 pr-10 pb-2 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`truncate ${selected ? "text-snow" : "text-fog"}`}>
            {selected?.label ?? placeholder}
          </span>
        </button>
        <span className={STATIC_LABEL}>{label}</span>
        <ChevronDown
          className={`pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 transition-transform duration-200 ${
            open ? "rotate-180 text-brand" : "text-fog"
          }`}
        />
      </span>

      {open && (
        <div
          className={`animate-dropdown-in absolute inset-x-0 z-50 overflow-hidden rounded-2xl border border-line bg-ink shadow-[0_18px_48px_-12px_rgba(16,24,40,0.28)] ring-1 ring-black/5 ${
            dropUp ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
          }`}
        >
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="h-10 w-full rounded-xl bg-ink2 px-3 text-sm text-snow outline-none placeholder:text-fog/70 focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1.5">
            {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-fog">No matches</li>}
            {visible.map((option, i) => {
              const isSelected = option.value === current;
              return (
                <li
                  key={option.value}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    i === active ? "bg-brand/[0.07] text-snow" : "text-snow/85"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isSelected && <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Message error={error} hint={hint} />
    </div>
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
      <span className="grid size-5 shrink-0 place-items-center rounded-md border-2 border-line bg-ink text-white shadow-[inset_0_1px_2px_rgba(16,24,40,0.06)] transition-all duration-200 hover:border-brand/50 peer-checked:scale-105 peer-checked:border-transparent peer-checked:bg-[linear-gradient(135deg,var(--color-brand),var(--color-brand2))] peer-checked:shadow-[0_3px_12px_color-mix(in_srgb,var(--color-brand)_40%,transparent)] peer-active:scale-90 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-2 [&>svg]:scale-0 [&>svg]:-rotate-12 [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-[cubic-bezier(0.2,0.9,0.3,1.4)] peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:rotate-0">
        <Check className="size-3.5" strokeWidth={3.5} />
      </span>
      <span>{label}</span>
    </label>
  );
}
