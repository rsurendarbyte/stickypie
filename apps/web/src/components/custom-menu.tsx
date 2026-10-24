"use client";

import Link from "@/components/page-link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ImageUp, LayoutGrid, QrCode, Type } from "lucide-react";
import { customSizes, formatINR } from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";

/** The ways to make your own sticker, each with its lowest price (hidden when unpriced). */
export function useCustomOptions() {
  const settings = useStoreSettings();
  const from = (prices: Record<string, number>) => {
    const sizes = customSizes(prices);
    return sizes.length ? Math.min(...sizes.map((s) => s.price)) : null;
  };
  return [
    { href: "/custom-stickers/design", icon: ImageUp, title: "Your design", text: "Logo, photo or artwork", from: from(settings.customPrices) },
    { href: "/qr-code-stickers", icon: QrCode, title: "QR code sticker", text: "UPI, WhatsApp, website", from: from(settings.qrPrices) },
    { href: "/name-stickers", icon: Type, title: "Name & text", text: "Your name in fun fonts", from: from(settings.textPrices) },
  ].filter((i) => i.from !== null);
}

const PEEL_OFF_MS = 360;

export const CUSTOM_PATHS = ["/custom-stickers", "/qr-code-stickers", "/name-stickers"];

/**
 * Header "Custom" item: a small menu of the ways to make your own sticker
 * (your design, QR code, name & text), each with its starting price. Opens on
 * hover for a mouse, on tap for a phone; closes on a pick, outside tap or Esc.
 */
export default function CustomMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const hoverClose = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef("");
  const active = CUSTOM_PATHS.some((p) => pathname.startsWith(p));
  // the menu is a label: it smooths down to open, and stays mounted while it peels off
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) return setShown(true);
    const t = setTimeout(() => setShown(false), PEEL_OFF_MS);
    return () => clearTimeout(t);
  }, [open]);

  // close when the page changes (a pick was made)
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = useCustomOptions();

  // mouse only: open on hover, with a short grace period to cross the gap
  const hover = (e: React.PointerEvent, enter: boolean) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverClose.current);
    if (enter) setOpen(true);
    else hoverClose.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <div ref={root} className="relative" onPointerEnter={(e) => hover(e, true)} onPointerLeave={(e) => hover(e, false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        // a mouse already opened it on hover, so a click keeps it open
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => setOpen((o) => (pointer.current === "mouse" ? true : !o))}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:px-4 ${
          active || open
            ? "bg-snow/[0.07] text-snow shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]"
            : "text-fog hover:bg-snow/5 hover:text-snow"
        }`}
      >
        Custom
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {(open || shown) && (
        // the shadow sits on this wrapper, so it follows the label as it peels
        <div
          className={`z-50 drop-shadow-[0_18px_24px_rgba(16,24,40,0.22)] max-sm:fixed max-sm:inset-x-3 max-sm:top-[62px] sm:absolute sm:top-full sm:left-0 sm:mt-2 sm:w-72 ${
            open ? "" : "pointer-events-none"
          }`}
        >
        <div
          role="menu"
          className={`cart-label relative rounded-[20px] border-[3px] border-white bg-ink2 p-1.5 ${open ? "panel-label--on" : "panel-label--off"}`}
        >
          <span aria-hidden className="cart-label-flap" />
          {items.map(({ href, icon: Icon, title, text, from: price }) => {
            const here = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${here ? "bg-brand/[0.07]" : "hover:bg-snow/5"}`}
              >
                <span className="pie-gradient grid size-9 shrink-0 -rotate-6 place-items-center rounded-[10px] text-white shadow-sm shadow-brand/30 transition-transform group-hover:rotate-0">
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-snow">{title}</span>
                  <span className="block truncate text-xs text-fog">{text}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] leading-tight text-fog">
                  from
                  <span className="block font-display text-sm font-bold text-snow">{formatINR(price!)}</span>
                </span>
              </Link>
            );
          })}
          <Link
            href="/custom-stickers"
            role="menuitem"
            className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border-t border-line/70 px-2.5 py-2 text-xs font-semibold text-brand hover:bg-brand/[0.06]"
          >
            <LayoutGrid className="size-3.5" /> All custom options
          </Link>
        </div>
        </div>
      )}
    </div>
  );
}
