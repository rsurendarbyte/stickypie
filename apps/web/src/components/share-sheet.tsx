"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Send, Share2 } from "lucide-react";
import LabelModal from "./label-modal";
import { closeShare, useShare, type ShareItem } from "@/lib/share";

/** The shop's share sheet (lib/share.ts): where the phone's own sheet isn't available. */
export default function ShareSheet() {
  const item = useShare();
  // kept while the label peels away after closing
  const [last, setLast] = useState<ShareItem | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (item) {
      setLast(item);
      setCopied(false);
    }
  }, [item]);
  if (!last) return null;
  const message = `${last.text} ${last.url}`;
  const enc = encodeURIComponent;
  const targets = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(message)}`, colour: "#25d366", letter: "W" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(last.url)}`, colour: "#1877f2", letter: "f" },
    { name: "X", href: `https://twitter.com/intent/tweet?text=${enc(last.text)}&url=${enc(last.url)}`, colour: "#111111", letter: "X" },
    { name: "Telegram", href: `https://t.me/share/url?url=${enc(last.url)}&text=${enc(last.text)}`, colour: "#229ed9", letter: "T" },
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(last!.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    // above everything, the puzzle game included (it can open this sheet)
    <div className="relative z-[95]">
    <LabelModal open={item !== null} onClose={closeShare} labelledBy="share-sheet-title" placement="bottom" className="max-w-sm p-5">
      <p id="share-sheet-title" className="flex items-center gap-2 font-display text-lg font-bold">
        <Share2 className="size-5 text-brand" /> Share
      </p>
      {/* what's being shared, as it will look */}
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-panel p-2.5">
        {last.image && <img src={last.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-snow">{last.title}</p>
          <p className="line-clamp-2 text-xs text-fog">{last.text}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {targets.map((t) => (
          <a
            key={t.name}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeShare}
            className="flex flex-col items-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold text-snow transition-colors hover:bg-panel"
          >
            <span className="grid size-11 place-items-center rounded-full font-display text-lg font-bold text-white" style={{ background: t.colour }}>
              {t.letter}
            </span>
            {t.name}
          </a>
        ))}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-white px-3 text-left text-sm"
      >
        {copied ? <Check className="size-4 shrink-0 text-mint" strokeWidth={3} /> : <Link2 className="size-4 shrink-0 text-fog" />}
        <span className="min-w-0 flex-1 truncate text-fog">{last.url.replace(/^https?:\/\//, "")}</span>
        <span className={`shrink-0 font-bold ${copied ? "text-mint" : "text-brand"}`}>{copied ? "Copied" : "Copy"}</span>
      </button>
      {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
        <button
          type="button"
          onClick={() => navigator.share({ title: last.title, text: last.text, url: last.url }).then(closeShare, () => {})}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 text-xs font-bold text-fog hover:text-brand"
        >
          <Send className="size-3.5" /> More apps
        </button>
      )}
    </LabelModal>
    </div>
  );
}
