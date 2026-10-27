"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { avatarSheetPrompt } from "@/lib/avatar-prompts";

/**
 * Avatar order: AI prompts per sheet (the client's styles, with their note) —
 * one copy button per pose set of the style — to paste into the AI image tool
 * with the client's photo attached.
 */
export default function AvatarOrderPrompts({
  sheets,
  note,
}: {
  sheets: { label: string; poseSets: string[] }[];
  note: string;
}) {
  const [open, setOpen] = useState(false);
  // Which button just copied: "<sheet index>-<set>".
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (n: number, style: string, poseSets: string[], set: number) =>
    navigator.clipboard
      .writeText(avatarSheetPrompt(style, "photo", poseSets, set - 1, note))
      .then(() => {
        const key = `${n}-${set}`;
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
      });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[11px] font-semibold text-snow"
      >
        <Sparkles className="size-3.5" /> AI prompts for this order
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-ink2 p-2">
          <p className="text-[11px] text-fog">
            For each sheet: open the AI tool, attach the client&apos;s photo
            (Open full size above), paste the prompt. Each set has different
            poses — try another if one doesn&apos;t come out well. Then upload
            the finished sheets below.
          </p>
          <ol className="space-y-1">
            {sheets.map(({ label: style, poseSets }, n) => (
              <li
                key={style}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">
                  <span className="text-fog">#{n + 1}</span> {style}
                </span>
                <span className="flex flex-wrap justify-end gap-1">
                  {poseSets.map((_, i) => {
                    const set = i + 1;
                    return (
                      <button
                        key={set}
                        type="button"
                        onClick={() => copy(n, style, poseSets, set)}
                        className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold ${
                          set === 1
                            ? "bg-snow text-ink"
                            : "border border-line text-snow"
                        }`}
                      >
                        {copied === `${n}-${set}` ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copied === `${n}-${set}` ? "Copied" : `Set ${set}`}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
