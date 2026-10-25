"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Maximize2, Minimize2, RotateCcw, Ruler, X, ZoomIn, ZoomOut } from "lucide-react";
import type { ProductSize } from "@stickypie/shared";
import { formatINR, formatInches, sizeDimensions } from "@stickypie/shared";
import { estimatePxPerInch, type PpiEstimate } from "@/lib/screen-ppi";

// A screen's "1 inch" in CSS pixels varies by device, so the shopper can
// calibrate once against a bank card (ISO ID-1: 3.370 × 2.125 in). Saved per device.
const CALIBRATION_KEY = "stickypie.px-per-inch.v1";
const CARD_W = 3.37;
const CARD_H = 2.125;
/** Zoom range for a closer look; 1 = actual size. */
const MAX_ZOOM = 6;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(1, z));

function loadCalibration(): number | null {
  try {
    const v = Number(localStorage.getItem(CALIBRATION_KEY));
    return v >= 40 && v <= 400 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Full-screen "actual size" view: the sticker drawn at its real printed size
 * on an inch grid, with a size switch and a bank-card outline for scale.
 */
export default function TrueSizePreview({
  open,
  onClose,
  name,
  imageUrl,
  aspectRatio,
  sizes,
  size,
  onSizeChange,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  imageUrl: string;
  aspectRatio: number | null;
  sizes: ProductSize[];
  size: number | null;
  onSizeChange: (inches: number) => void;
}) {
  const [ppi, setPpi] = useState(96);
  const [calibrated, setCalibrated] = useState(false);
  const [auto, setAuto] = useState<PpiEstimate>({ pxPerInch: 96, source: "estimate" });
  const [calibrating, setCalibrating] = useState(false);
  const [fit, setFit] = useState(false);
  const [ratio, setRatio] = useState<number | null>(aspectRatio);
  const stage = useRef<HTMLDivElement>(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  // Closer look: pinch / wheel / double-tap / buttons. The inch grid and size
  // labels zoom with the sticker, and the bottom bar says it's zoomed.
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number; mx: number; my: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const resetZoom = () => setZoom({ z: 1, x: 0, y: 0 });
  const zoomBy = (factor: number) =>
    setZoom((v) => {
      const z = clampZoom(v.z * factor);
      return z === 1 ? { z: 1, x: 0, y: 0 } : { z, x: (v.x * z) / v.z, y: (v.y * z) / v.z };
    });

  useEffect(() => setRatio(aspectRatio), [aspectRatio]);

  // Stays mounted while the sheet peels off, like every pop-up in the shop.
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 520);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load the device calibration (or a best guess) when opened.
  useEffect(() => {
    if (!open) return;
    const saved = loadCalibration();
    const estimate = estimatePxPerInch();
    setAuto(estimate);
    setPpi(saved ?? estimate.pxPerInch);
    setCalibrated(saved !== null);
  }, [open]);

  // Lock page scroll, close on Esc.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (calibrating ? setCalibrating(false) : onClose());
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, calibrating]);

  // Track the drawing area so "fit" can scale down big stickers.
  useEffect(() => {
    if (!open || !stage.current) return;
    const el = stage.current;
    const update = () => setStageBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // A new size, shape or fit starts again at actual size.
  const inches = size ?? sizes[sizes.length - 1]?.inches ?? null;
  useEffect(() => resetZoom(), [open, inches, fit]);

  // Mouse wheel / trackpad pinch zooms (not the page): needs a non-passive listener.
  useEffect(() => {
    const el = stage.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x: zoom.x, y: zoom.y };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      const z = clampZoom((p.z * Math.hypot(a.x - b.x, a.y - b.y)) / (p.d || 1));
      setZoom(z === 1 ? { z: 1, x: 0, y: 0 } : { z, x: (p.x * z) / p.z + ((a.x + b.x) / 2 - p.mx), y: (p.y * z) / p.z + ((a.y + b.y) / 2 - p.my) });
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    // One finger: move the zoomed picture, or scroll a real-size sticker bigger than the screen.
    if (zoom.z > 1) setZoom((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    else if (stage.current) {
      stage.current.scrollLeft -= dx;
      stage.current.scrollTop -= dy;
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const wasPinch = pointers.current.size >= 2;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (wasPinch || e.pointerType === "mouse") return;
    // Double-tap: zoom in to 2.5×, or back to actual size.
    const t = Date.now();
    if (t - lastTap.current < 300) {
      lastTap.current = 0;
      setZoom((v) => (v.z > 1 ? { z: 1, x: 0, y: 0 } : { z: 2.5, x: 0, y: 0 }));
    } else lastTap.current = t;
  }
  const dims = inches !== null && ratio ? sizeDimensions(inches, ratio) : null;
  const realW = dims ? dims.width * ppi : 0;
  const realH = dims ? dims.height * ppi : 0;
  // Room for the sticker plus its size labels.
  const needW = realW + 80;
  const needH = realH + 110;
  const tooBig = stageBox.w > 0 && (needW > stageBox.w || needH > stageBox.h);
  const scale = fit && tooBig ? Math.min(stageBox.w / needW, stageBox.h / needH) : 1;
  const cell = ppi * scale * zoom.z;

  // Start scrolled to the middle when the real size is bigger than the screen.
  useEffect(() => {
    const el = stage.current;
    if (!open || !el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [open, inches, fit, ppi, ratio]);

  const grid = useMemo(
    () => ({
      backgroundImage: `linear-gradient(to right, rgba(16,24,40,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,24,40,0.16) 1px, transparent 1px), linear-gradient(to right, rgba(16,24,40,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,24,40,0.06) 1px, transparent 1px)`,
      backgroundSize: `${cell}px ${cell}px, ${cell}px ${cell}px, ${cell / 4}px ${cell / 4}px, ${cell / 4}px ${cell / 4}px`,
      backgroundPosition: `calc(50% + ${zoom.x}px) calc(50% + ${zoom.y}px)`,
    }),
    [cell, zoom.x, zoom.y]
  );

  if (!shown || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} at actual size`}
      // the peel sweeps the screen's diagonal, whatever its size
      style={{ "--peel-max": `${window.innerWidth + window.innerHeight}px` } as React.CSSProperties}
      className={`cart-label fixed inset-0 z-[80] flex flex-col bg-[#f7f7f9] ${
        closing ? "screen-label--off pointer-events-none" : "screen-label--on"
      }`}
    >
      <span aria-hidden className="cart-label-flap" />
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-brand uppercase">
            <Ruler className="size-3.5" /> Actual size
          </p>
          <p className="truncate font-display text-base font-semibold">{name}</p>
        </div>
        {sizes.length > 0 && (
          <div role="radiogroup" aria-label="Sticker size" className="flex flex-wrap justify-end gap-1.5">
            {sizes.map((s) => {
              const active = s.inches === inches;
              return (
                <button
                  key={s.inches}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSizeChange(s.inches)}
                  className={`rounded-xl border px-3 py-1.5 text-left transition-all ${
                    active ? "border-brand bg-brand/[0.07] ring-1 ring-brand" : "border-line bg-white hover:border-snow/30"
                  }`}
                >
                  <span className="block font-display text-sm leading-tight font-bold">{formatInches(s.inches)}″</span>
                  <span className={`block text-[10px] font-semibold ${active ? "text-brand" : "text-fog"}`}>
                    {formatINR(s.price)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-10 place-items-center rounded-full border border-line bg-white text-snow transition-colors hover:border-brand/50 hover:text-brand"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Drawing area */}
      <div
        ref={stage}
        className="relative min-h-0 flex-1 touch-none overflow-auto overscroll-contain"
        style={grid}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setZoom((v) => (v.z > 1 ? { z: 1, x: 0, y: 0 } : { z: 2.5, x: 0, y: 0 }))}
      >
        <div
          className="flex min-h-full min-w-full items-center justify-center p-6"
          style={{
            width: tooBig && !fit ? needW : undefined,
            height: tooBig && !fit ? needH : undefined,
            transform: zoom.z === 1 ? undefined : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`,
            transformOrigin: "center center",
          }}
        >
          {dims ? (
            <figure className="relative" style={{ width: realW * scale, height: realH * scale }}>
              <img
                src={imageUrl}
                alt={name}
                draggable={false}
                className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(16,24,40,0.22)] select-none"
              />
              {/* width bracket */}
              <span className="absolute inset-x-0 -bottom-7 flex items-center gap-1.5">
                <span className="h-2.5 w-px bg-snow/50" />
                <span className="h-px flex-1 bg-snow/40" />
                <span className="rounded bg-white px-1.5 text-[11px] font-bold whitespace-nowrap text-snow shadow-sm">
                  {formatInches(dims.width)} in
                </span>
                <span className="h-px flex-1 bg-snow/40" />
                <span className="h-2.5 w-px bg-snow/50" />
              </span>
              {/* height bracket */}
              <span className="absolute inset-y-0 -left-7 flex flex-col items-center gap-1.5">
                <span className="h-px w-2.5 bg-snow/50" />
                <span className="w-px flex-1 bg-snow/40" />
                <span className="-rotate-90 rounded bg-white px-1.5 text-[11px] font-bold whitespace-nowrap text-snow shadow-sm">
                  {formatInches(dims.height)} in
                </span>
                <span className="w-px flex-1 bg-snow/40" />
                <span className="h-px w-2.5 bg-snow/50" />
              </span>
            </figure>
          ) : (
            // Shape not known yet: measure it from the image.
            <img
              src={imageUrl}
              alt={name}
              className="max-h-[60vh] max-w-full object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
              }}
            />
          )}
        </div>
      </div>

      {/* Zoom controls, over the drawing area's corner */}
      {dims && (
        <div className="pointer-events-none relative">
          <div className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-1 rounded-full border border-line bg-white/95 p-1 shadow-md backdrop-blur">
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} disabled={zoom.z <= 1} className="grid size-9 place-items-center rounded-full text-snow disabled:text-fog/40">
              <ZoomOut className="size-4.5" />
            </button>
            <span className="min-w-11 text-center text-xs font-bold tabular-nums">{Math.round(zoom.z * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)} disabled={zoom.z >= MAX_ZOOM} className="grid size-9 place-items-center rounded-full text-snow disabled:text-fog/40">
              <ZoomIn className="size-4.5" />
            </button>
            {zoom.z > 1 && (
              <button type="button" onClick={resetZoom} className="ml-0.5 flex h-9 items-center gap-1 rounded-full bg-brand px-3 text-xs font-bold text-white">
                <RotateCcw className="size-3.5" /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-white/90 px-4 py-3 text-xs backdrop-blur sm:px-6">
        <div className="w-full text-fog sm:w-auto sm:min-w-0 sm:flex-1">
          {dims ? (
            <>
              <p>
                Prints at <b className="text-snow">{formatInches(dims.width)} × {formatInches(dims.height)} in</b> · 1
                square = 1 inch
                {scale < 1 && zoom.z === 1 && <> · shown at {Math.round(scale * 100)}%</>}
              </p>
              {zoom.z > 1 && (
                <p className="font-semibold text-brand">
                  Zoomed {Math.round(zoom.z * scale * 100)}% for a closer look · Reset for actual size
                </p>
              )}
              {calibrated ? (
                <p>Sized for this screen (calibrated)</p>
              ) : auto.source === "device" ? (
                <p>True size for your {auto.device}</p>
              ) : (
                <p className="text-gold">Close to real size — tap Calibrate with a bank card for exact size</p>
              )}
            </>
          ) : (
            <p>Measuring…</p>
          )}
        </div>
        {tooBig && (
          <button
            type="button"
            onClick={() => setFit((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 font-semibold text-snow transition-colors hover:border-brand/50"
          >
            {fit ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
            {fit ? "Real size (scroll)" : "Fit to screen"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCalibrating(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 font-semibold text-snow transition-colors hover:border-brand/50"
        >
          <Ruler className="size-3.5" /> {calibrated ? "Re-calibrate" : "Calibrate"}
        </button>
      </div>

      {calibrating && (
        <Calibrator
          ppi={ppi}
          autoPpi={auto.pxPerInch}
          onChange={setPpi}
          onDone={() => {
            try {
              localStorage.setItem(CALIBRATION_KEY, String(Math.round(ppi * 10) / 10));
            } catch {
              // private mode: works for this visit only
            }
            setCalibrated(true);
            setCalibrating(false);
          }}
          onReset={() => {
            try {
              localStorage.removeItem(CALIBRATION_KEY);
            } catch {
              // ignore
            }
            setPpi(auto.pxPerInch);
            setCalibrated(false);
            setCalibrating(false);
          }}
          onCancel={() => {
            setPpi(loadCalibration() ?? auto.pxPerInch);
            setCalibrating(false);
          }}
        />
      )}
    </div>,
    document.body
  );
}

/** Hold a real bank card on the screen and resize the outline to match it. */
function Calibrator({
  ppi,
  autoPpi,
  onChange,
  onDone,
  onReset,
  onCancel,
}: {
  ppi: number;
  autoPpi: number;
  onChange: (ppi: number) => void;
  onDone: () => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  // A card is wider than a phone screen — stand it upright when it won't fit.
  const upright = typeof window !== "undefined" && CARD_W * ppi > window.innerWidth * 0.92;
  const w = (upright ? CARD_H : CARD_W) * ppi;
  const h = (upright ? CARD_W : CARD_H) * ppi;
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-white/95 px-5 py-6 text-center backdrop-blur">
      <div>
        <p className="font-display text-xl font-bold">Match a real bank card</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-fog">
          Hold any debit / credit card flat against the screen{upright ? " (standing upright)" : ""} and slide until
          the outline is exactly the same size.
        </p>
      </div>
      <div
        className="grid place-items-center rounded-[12px] border-2 border-brand bg-brand/[0.05] text-xs font-semibold text-brand"
        style={{ width: w, height: h }}
      >
        <CreditCard className="size-6" />
      </div>
      <div className="flex w-full max-w-sm items-center gap-3">
        <button
          type="button"
          aria-label="Smaller"
          onClick={() => onChange(Math.max(40, ppi - 1))}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-lg font-bold"
        >
          −
        </button>
        <input
          type="range"
          min={40}
          max={260}
          step={0.5}
          value={ppi}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Card outline size"
          className="w-full accent-[#ff2e63]"
        />
        <button
          type="button"
          aria-label="Bigger"
          onClick={() => onChange(Math.min(260, ppi + 1))}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-lg font-bold"
        >
          +
        </button>
      </div>
      {Math.abs(ppi - autoPpi) > 0.5 && (
        <button type="button" onClick={onReset} className="text-xs font-semibold text-fog underline hover:text-brand">
          Reset to automatic size
        </button>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold">
          Cancel
        </button>
        <button
          type="button"
          onClick={onDone}
          className="peel-btn peel-btn--brand rounded-xl px-6 py-2.5 text-sm font-bold"
        >
          It matches — save
        </button>
      </div>
    </div>
  );
}
