"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBackToClose } from "@/lib/back-close";
import ZoomPane from "./zoom-pane";

/**
 * Full-screen look at one picture (a poster pack's collage): pinch, double-tap,
 * wheel or +/− to zoom in. Tap outside or the phone's back button closes it.
 */
export default function ImageZoom({
  open,
  onClose,
  src,
  title,
  ratio = 2 / 3,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  title: string;
  /** The picture's width / height (poster packs are 2:3). */
  ratio?: number;
}) {
  useBackToClose(open, onClose);
  const down = useRef<{ x: number; y: number } | null>(null);
  // The page behind stays still while the lightbox is open; Esc closes it.
  useEffect(() => {
    if (!open) return;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  // On <body>, above the header, cart bar and every floating button — just the picture.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // React passes events from a portal up to the component that opened it (the
      // product picture, which opens this, and its swipe-to-next) — keep them here.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[2147483000] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 z-10 grid size-10 place-items-center rounded-full bg-white text-neutral-900 shadow"
      >
        <X className="size-5" />
      </button>
      {/* Zooms across the whole screen. A tap (not a drag) on the dark around the
          picture closes; ZoomPane keeps its own clicks, so this listens first. */}
      <div
        className="absolute inset-0"
        onPointerDownCapture={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          const start = down.current;
          const still = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6;
          if (still && target.tagName !== "IMG" && !target.closest("button")) onClose();
        }}
      >
        <ZoomPane resetKey={src}>
          <img
            src={src}
            alt={title}
            draggable={false}
            className="block rounded-xl object-contain select-none"
            style={{ width: `min(calc(100vw - 32px), calc((100dvh - 32px) * ${ratio}))`, aspectRatio: ratio }}
          />
        </ZoomPane>
      </div>
    </div>,
    document.body
  );
}
