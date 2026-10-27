"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

/**
 * Avatar sticker sheets on an order: upload the sheets we made (one per
 * style). They show on the customer's order page straight away (no
 * approval step), then we print.
 */
export default function FinishedStickers({
  orderId,
  itemId,
  pages,
  initial,
}: {
  orderId: string;
  itemId: string;
  /** Pages in the book. */
  pages: number;
  initial: string[];
}) {
  const [urls, setUrls] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("itemId", itemId);
    for (const f of Array.from(files)) form.append("files", f);
    const res = await fetch(`/api/orders/${orderId}/finished`, { method: "POST", body: form }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setUrls(data.urls);
    else setError(data.error ?? "Upload failed");
    setBusy(false);
  }

  async function remove(url: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/finished`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, urls: urls.filter((u) => u !== url) }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setUrls(data.urls);
    else setError(data.error ?? "Couldn't remove");
    setBusy(false);
  }

  return (
    <div className="w-full rounded-xl border border-line bg-ink p-3">
      <div className="flex items-center gap-2">
        <p className="mr-auto text-xs font-semibold">
          Finished packs{" "}
          <span className={urls.length >= pages ? "text-mint" : "text-gold"}>
            {urls.length}/{pages}
          </span>
          <span className="block font-normal text-fog">Shown on the customer&apos;s order page as soon as you upload.</span>
        </p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          multiple
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-snow px-3 text-xs font-bold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload packs
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-brand">{error}</p>}
      {urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {urls.map((url) => (
            <span key={url} className="relative grid size-20 place-items-center rounded-lg bg-panel p-1.5 ring-1 ring-line">
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="max-h-16 max-w-16 object-contain" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(url)}
                aria-label="Remove pack"
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand text-white shadow"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
