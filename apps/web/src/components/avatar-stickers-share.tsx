"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Instagram, Loader2, MessageCircle, Share2, X } from "lucide-react";

const STORY_W = 1080;
const STORY_H = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** 1080×1920 story card: the finished stickers on a soft sheet, with the shop link. */
async function drawStory(urls: string[], makeUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, STORY_W, STORY_H);
  bg.addColorStop(0, "#fff1f5");
  bg.addColorStop(1, "#fff7ed");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  ctx.fillStyle = "#15161e";
  ctx.textAlign = "center";
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.fillText("Stickers of me!", STORY_W / 2, 230);

  const images = (await Promise.all(urls.slice(0, 6).map((u) => loadImage(u).catch(() => null)))).filter(
    (i): i is HTMLImageElement => i !== null
  );
  const cols = images.length <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(images.length / cols));
  const cell = Math.min((STORY_W - 160) / cols, (STORY_H - 640) / rows);
  const gridW = cell * cols;
  const top = 330 + (STORY_H - 640 - cell * rows) / 2;
  images.forEach((img, i) => {
    const cx = (STORY_W - gridW) / 2 + (i % cols) * cell + cell / 2;
    const cy = top + Math.floor(i / cols) * cell + cell / 2;
    const scale = Math.min((cell * 0.86) / img.width, (cell * 0.86) / img.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((i % 2 ? 1 : -1) * 3 * Math.PI) / 180);
    ctx.shadowColor = "rgba(16,24,40,0.25)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(img, (-img.width * scale) / 2, (-img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.restore();
  });

  ctx.fillStyle = "#e8336d";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.fillText("Make yours at", STORY_W / 2, STORY_H - 220);
  ctx.fillStyle = "#15161e";
  ctx.font = "bold 58px system-ui, sans-serif";
  ctx.fillText(makeUrl.replace(/^https?:\/\//, ""), STORY_W / 2, STORY_H - 140);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png")
  );
}

/**
 * Avatar sticker packs finished: the packs we made, shown on the order page (tap
 * one for a full-screen preview) with
 * ways to share them — WhatsApp, an Instagram story image, or the phone's
 * share sheet.
 */
export default function AvatarStickersShare({ urls, makeUrl }: { urls: string[]; makeUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Full-screen preview: which pack is open.
  const [view, setView] = useState<number | null>(null);
  const step = (by: number) => setView((v) => (v === null ? v : (v + by + urls.length) % urls.length));
  useEffect(() => {
    if (view === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const text = `Got my own avatar stickers from StickyPie! Make yours: ${makeUrl}`;

  async function story() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await drawStory(urls, makeUrl);
      const file = new File([blob], "my-stickypie-stickers.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        setNote("Story image saved — add it to your Instagram story.");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setNote("Couldn't make the story image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ text, url: makeUrl }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(text).catch(() => {});
      setNote("Link copied.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold">Your sticker packs</h2>
      <p className="text-xs text-fog">Here&apos;s what we&apos;re printing for you.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setView(i)}
            aria-label={`View sticker pack ${i + 1} full screen`}
            className="grid aspect-square cursor-zoom-in place-items-center rounded-2xl bg-panel p-3 ring-1 ring-line transition-transform hover:scale-[1.02]"
          >
            <img src={url} alt={`Sticker pack ${i + 1}`} className="sticker-cut max-h-full max-w-full object-contain" />
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="peel-btn peel-btn--light flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold sm:text-sm"
        >
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={story}
          className="peel-btn peel-btn--brand flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold sm:text-sm"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Instagram className="size-4" />} Story
        </button>
        <button
          type="button"
          onClick={shareLink}
          className="peel-btn peel-btn--light flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold sm:text-sm"
        >
          <Share2 className="size-4" /> Share
        </button>
      </div>
      {note && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fog">
          <Download className="size-3.5" /> {note}
        </p>
      )}

      {/* Full-screen preview, fitted to the screen */}
      {view !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Sticker pack ${view + 1} of ${urls.length}`}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setView(null)}
        >
          <button
            type="button"
            onClick={() => setView(null)}
            aria-label="Close"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white text-neutral-900 shadow"
          >
            <X className="size-5" />
          </button>
          <img
            src={urls[view]}
            alt={`Sticker pack ${view + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-120px)] max-w-[calc(100vw-120px)] rounded-2xl bg-white object-contain p-2 shadow-2xl max-sm:max-w-[calc(100vw-32px)]"
          />
          <p className="mt-3 text-sm font-semibold text-white/80">
            Pack {view + 1} of {urls.length}
          </p>
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous pack"
                className="absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow sm:left-4"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next pack"
                className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow sm:right-4"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
