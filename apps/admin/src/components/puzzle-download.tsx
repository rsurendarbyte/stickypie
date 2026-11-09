"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { puzzleZip } from "@stickypie/shared/wall-sheets";
import { imageDownloadHref } from "@/lib/img";

/**
 * A puzzle poster line's print files, made here in the browser: a ZIP of the 9
 * cards at the ordered card size (300 dpi) plus the layout guide (see puzzleZip).
 */
export default function PuzzleDownload({ imageUrl, name, cardInches }: { imageUrl: string; name: string; cardInches: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = `${Math.round(((cardInches * 2) / 3) * 10) / 10}×${cardInches}`;

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const src = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Couldn't load the poster file"));
        img.src = imageDownloadHref(imageUrl);
      });
      const zip = await puzzleZip(src, cardInches, name);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-puzzle-9-cards-${size}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the print files");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={make}
        disabled={busy}
        title={`9 cards at ${size} in + layout guide (ZIP)`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-xs font-semibold text-fog transition-colors hover:bg-white/10 hover:text-snow disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        {busy ? "Making…" : `9 cards ${size} · ZIP`}
      </button>
      {error && <span className="max-w-48 text-right text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
