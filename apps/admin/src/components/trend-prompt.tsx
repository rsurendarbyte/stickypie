"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, Sparkles } from "lucide-react";
import { DEFAULT_TREND_WALLS_PROMPT, type TrendWalls } from "@stickypie/shared";
import { useToast } from "./toast";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The instructions the morning run follows, editable; and what it made last. */
export default function TrendPrompt({ initial }: { initial: TrendWalls }) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(initial.prompt);
  const [text, setText] = useState(initial.prompt);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = initial.lastRun;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/trend-walls", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    setBusy(false);
    const json = await res.json().catch(() => null);
    if (!res.ok) return toast(json?.error ?? "Couldn't save the prompt", "error");
    setSaved(json.trendWalls.prompt);
    setText(json.trendWalls.prompt);
    toast("Saved — the next morning run uses it");
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-ink2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left">
        <Sparkles className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Daily prompt</span>
          <span className="block truncate text-xs text-fog">
            {run
              ? `Last run ${when(run.at)}: made ${run.made.length}${run.skipped.length ? `, ${run.skipped.length} failed` : ""}`
              : "Not run yet"}
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-fog transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <p className="mb-2 text-xs text-fog">
            What the morning run follows when it picks walls from today&apos;s searches. Changes apply from the next run.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={11}
            className="w-full rounded-xl border border-line bg-panel p-3 text-sm leading-relaxed text-snow outline-none focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || text.trim() === saved}
              onClick={save}
              className="pie-gradient rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save prompt"}
            </button>
            {text !== DEFAULT_TREND_WALLS_PROMPT && (
              <button
                type="button"
                onClick={() => setText(DEFAULT_TREND_WALLS_PROMPT)}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs text-fog hover:text-snow"
              >
                <RotateCcw className="size-3.5" /> Start from the default
              </button>
            )}
          </div>
          {run && (run.made.length > 0 || run.skipped.length > 0) && (
            <div className="mt-4 text-xs text-fog">
              <p className="font-semibold text-snow">Last run · {when(run.at)}</p>
              {run.made.length > 0 && <p className="mt-1">Made: {run.made.join(", ")}</p>}
              {run.skipped.map((s) => (
                <p key={s} className="mt-1 text-brand">
                  ✘ {s}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
