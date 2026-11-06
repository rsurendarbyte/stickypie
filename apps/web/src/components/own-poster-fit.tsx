"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, TriangleAlert, ZoomIn, ZoomOut } from "lucide-react";
import { CUSTOM_STICKER_MAX_BYTES } from "@stickypie/shared";
import type { PosterFit } from "@/lib/own-posters";

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
/** Print file for the biggest size, 6×9 in at 300 dpi: a poster can be dragged to any spot on the wall. */
const PRINT_WIDTH = 1800;
/** Below this the picture is stretched thin on paper, so the shopper is told. */
const SHARP_DPI = 150;

type Picture = { url: string; img: HTMLImageElement };

/** How far the picture spreads past the 2:3 frame, in frames, across and down. */
function spread(img: HTMLImageElement, zoom: number) {
  const wide = (img.naturalWidth / img.naturalHeight) * 1.5;
  return { across: zoom * Math.max(1, wide), down: zoom * Math.max(1, 1 / wide) };
}

function keepInside(img: HTMLImageElement, fit: PosterFit): PosterFit {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, fit.zoom));
  const { across, down } = spread(img, zoom);
  const clamp = (at: number, size: number) => Math.min(1 - 0.5 / size, Math.max(0.5 / size, at));
  return { zoom, x: clamp(fit.x, across), y: clamp(fit.y, down) };
}

/** The part of the picture inside the frame, in the picture's pixels. */
function cropOf(img: HTMLImageElement, fit: PosterFit) {
  const { across, down } = spread(img, fit.zoom);
  const width = img.naturalWidth / across;
  const height = img.naturalHeight / down;
  return { left: fit.x * img.naturalWidth - width / 2, top: fit.y * img.naturalHeight - height / 2, width, height };
}

/** The framed part as the file to print: 2:3, white behind any see-through parts. */
async function printFile(img: HTMLImageElement, fit: PosterFit): Promise<Blob> {
  const crop = cropOf(img, fit);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(PRINT_WIDTH, Math.round(crop.width));
  canvas.height = Math.round(canvas.width * 1.5);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.left, crop.top, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  for (let quality = 0.92; ; quality -= 0.1) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("no file");
    if (blob.size <= CUSTOM_STICKER_MAX_BYTES || quality < 0.5) return blob;
  }
}

/**
 * The shopper places their picture in a poster's frame: drag to move, pinch or the
 * slider to zoom. What shows in the frame is what prints.
 */
export default function OwnPosterFit({
  source,
  start,
  inches,
  onPut,
  onOther,
}: {
  source: Blob;
  start?: PosterFit;
  /** The spot's size, longest side. */
  inches: number;
  onPut: (art: Blob, fit: PosterFit) => void | Promise<void>;
  onOther: () => void;
}) {
  const [picture, setPicture] = useState<Picture | null>(null);
  const [fit, setFit] = useState<PosterFit>(start ?? { zoom: 1, x: 0.5, y: 0.5 });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    let live = true;
    img.src = url;
    setPicture(null);
    setFailed(false);
    img
      .decode()
      .then(() => {
        if (!live) return;
        setPicture({ url, img });
        setFit(keepInside(img, start ?? { zoom: 1, x: 0.5, y: 0.5 }));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  function drag(e: React.PointerEvent) {
    const held = fingers.current;
    const was = held.get(e.pointerId);
    if (!was || !picture || !frame.current) return;
    const now = { x: e.clientX, y: e.clientY };
    const other = [...held].find(([id]) => id !== e.pointerId)?.[1];
    held.set(e.pointerId, now);
    const { width, height } = frame.current.getBoundingClientRect();
    setFit((at) => {
      if (other) {
        const by = Math.hypot(now.x - other.x, now.y - other.y) / (Math.hypot(was.x - other.x, was.y - other.y) || 1);
        return keepInside(picture.img, { ...at, zoom: at.zoom * by });
      }
      const { across, down } = spread(picture.img, at.zoom);
      return keepInside(picture.img, { ...at, x: at.x - (now.x - was.x) / (width * across), y: at.y - (now.y - was.y) / (height * down) });
    });
  }

  const zoomTo = (zoom: number) => picture && setFit((at) => keepInside(picture.img, { ...at, zoom }));

  const release = (e: React.PointerEvent) => fingers.current.delete(e.pointerId);

  async function put() {
    if (!picture) return;
    setBusy(true);
    try {
      await onPut(await printFile(picture.img, fit), fit);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const shown = picture && spread(picture.img, fit.zoom);
  const sharp = picture && cropOf(picture.img, fit).height / inches >= SHARP_DPI;
  const size = inches === 9 ? "6×9 in" : "4×6 in";

  if (failed) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-fog">That picture couldn&apos;t be opened. Try a JPG or PNG.</p>
        <button type="button" onClick={onOther} className="peel-btn peel-btn--light mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold">
          <ImageUp className="size-4" /> Choose another
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div
        ref={frame}
        className="relative mx-auto aspect-[2/3] w-[min(100%,34dvh)] cursor-grab touch-none overflow-hidden rounded-md bg-panel ring-2 ring-snow select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={drag}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {picture && shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture.url}
            alt="Your poster"
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: `${shown.across * 100}%`,
              height: `${shown.down * 100}%`,
              left: `${(0.5 - fit.x * shown.across) * 100}%`,
              top: `${(0.5 - fit.y * shown.down) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="mx-auto mt-2 flex w-[min(100%,34dvh)] items-center gap-1">
        <button type="button" aria-label="Zoom out" onClick={() => zoomTo(fit.zoom - ZOOM_STEP)} disabled={!picture || fit.zoom <= 1} className="grid size-9 shrink-0 place-items-center rounded-full text-snow disabled:text-fog/50">
          <ZoomOut className="size-5" />
        </button>
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={fit.zoom}
          disabled={!picture}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="fit-zoom min-w-0 flex-1"
          style={{ "--at": `${((fit.zoom - 1) / (MAX_ZOOM - 1)) * 100}%` } as React.CSSProperties}
        />
        <button type="button" aria-label="Zoom in" onClick={() => zoomTo(fit.zoom + ZOOM_STEP)} disabled={!picture || fit.zoom >= MAX_ZOOM} className="grid size-9 shrink-0 place-items-center rounded-full text-snow disabled:text-fog/50">
          <ZoomIn className="size-5" />
        </button>
      </div>
      {picture && (
        <p className={`mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold ${sharp ? "text-mint" : "text-gold"}`}>
          {sharp ? <Check className="size-3.5" strokeWidth={3} /> : <TriangleAlert className="size-3.5" />}
          {sharp ? `Sharp at ${size}` : `Small picture, may print soft at ${size}`}
        </p>
      )}
      <p className="mt-1 text-center text-[11px] leading-snug text-fog">
        Stays on your phone until you pay. Only add pictures you&apos;re OK to have printed.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onOther} className="peel-btn peel-btn--light h-11 flex-1 rounded-full text-sm font-bold">
          Choose another
        </button>
        <button type="button" onClick={put} disabled={!picture || busy} className="peel-btn h-11 flex-1 rounded-full text-sm font-bold">
          Put on wall
        </button>
      </div>
    </div>
  );
}
