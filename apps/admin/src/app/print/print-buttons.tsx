"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow"
    >
      <Printer className="size-4" /> Print (A4)
    </button>
  );
}

/** Saves the card as an A4 PNG (300 dpi: 2480 × 3508 px) for printing elsewhere or sharing. */
export function DownloadImageButton({ fileName }: { fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function save() {
    const card = document.querySelector<HTMLElement>(".card");
    if (!card) return;
    setBusy(true);
    setError(false);
    try {
      const { toPng } = await import("html-to-image");
      const width = card.offsetWidth;
      const url = await toPng(card, { pixelRatio: 2480 / width, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
    } catch (err) {
      console.error("[thank-you card] image", err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={save}
      disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-800 shadow-sm disabled:opacity-60"
    >
      <Download className="size-4" /> {busy ? "Making image…" : error ? "Try again" : "Download image"}
    </button>
  );
}
