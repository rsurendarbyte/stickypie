"use client";

import { useEffect, useState } from "react";

const PEEL_OFF_MS = 420;

/**
 * Every pop-up in the shop: a sticker label (white die-cut edge) that smooths
 * down onto the page to open and peels off to close — the same peel as the
 * cart label. Stays mounted while it peels off, then unmounts.
 */
export default function LabelModal({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = "dialog",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  /** Size and padding of the label, e.g. "max-w-sm p-6". */
  className?: string;
  children: React.ReactNode;
}) {
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
    }, PEEL_OFF_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!shown) return null;
  return (
    <div className={`fixed inset-0 z-[80] grid place-items-center p-4 ${closing ? "pointer-events-none" : ""}`}>
      <div
        aria-hidden
        onClick={onClose}
        className={`dialog-backdrop absolute inset-0 bg-[rgba(16,24,40,0.35)] backdrop-blur-[2px] transition-opacity duration-300 ${
          closing ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`cart-label relative w-full rounded-[24px] border-[3px] border-white bg-ink2 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.5)] ${
          closing ? "dialog-label--off" : "dialog-label--on"
        } ${className}`}
      >
        <span aria-hidden className="cart-label-flap" />
        {children}
      </div>
    </div>
  );
}
