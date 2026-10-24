"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Home, LayoutGrid, Menu, Search, Sparkles, UserRound, X } from "lucide-react";
import { formatINR } from "@stickypie/shared";
import { useFeatures } from "@/lib/live-catalog";
import { useShopper } from "@/lib/shopper-auth";
import { SURFACES } from "@/lib/surfaces";
import { CUSTOM_PATHS, useCustomOptions } from "./custom-menu";
import { cartUiHidden } from "./cart-strip";
import LabelModal from "./label-modal";

/** Pages with their own bottom bar (buy / book / pay) — no tab bar there. */
function ownBottomBar(pathname: string) {
  return (
    pathname.startsWith("/sticker/") ||
    pathname.startsWith("/custom-stickers/design") ||
    pathname.startsWith("/qr-code-stickers") ||
    pathname.startsWith("/name-stickers") ||
    cartUiHidden(pathname)
  );
}

const MORE_LINKS = [
  { label: "New drops", href: "/stickers?sort=new" },
  ...SURFACES.map((s) => ({ label: s.name, href: `/${s.slug}` })),
];
const HELP_LINKS = [
  { label: "Contact us", href: "/contact" },
  { label: "Shipping", href: "/legal/shipping" },
  { label: "Refunds", href: "/legal/refunds" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
];

/**
 * Phones only: the shop's main menu pinned to the bottom, in thumb reach —
 * Home, Stickers, Custom (a sheet of the make-your-own options), Account and
 * Menu (a sheet with everything else). The active tab sits on a small sticker
 * label that smooths down when you land on it; the sheets are label pop-ups
 * that smooth down to open and peel off to close.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const features = useFeatures();
  const shopper = useShopper();
  const custom = useCustomOptions();
  const [sheet, setSheet] = useState<"custom" | "menu" | null>(null);
  const shown = !ownBottomBar(pathname);

  // close a sheet once its link has been followed
  useEffect(() => setSheet(null), [pathname]);

  // lets the cart strip and the page foot make room for the bar (CSS --tabbar)
  useEffect(() => {
    const root = document.documentElement;
    if (shown) root.dataset.tabbar = "";
    else delete root.dataset.tabbar;
    return () => {
      delete root.dataset.tabbar;
    };
  }, [shown]);

  if (!shown) return null;

  const customOn = features.customStickers && custom.length > 0;
  const tabs: Array<{ key: string; label: string; icon: typeof Home; href?: string; active: boolean; onClick?: () => void }> = [
    { key: "home", label: "Home", icon: Home, href: "/", active: pathname === "/" && !sheet },
    { key: "stickers", label: "Stickers", icon: LayoutGrid, href: "/stickers", active: pathname.startsWith("/stickers") && !sheet },
    ...(customOn
      ? [{ key: "custom", label: "Custom", icon: Sparkles, active: sheet === "custom" || (!sheet && CUSTOM_PATHS.some((p) => pathname.startsWith(p))), onClick: () => setSheet("custom") }]
      : []),
    ...(shopper.enabled
      ? [{ key: "account", label: shopper.email ? "Orders" : "Sign in", icon: UserRound, href: "/account", active: pathname.startsWith("/account") && !sheet }]
      : []),
    { key: "menu", label: "Menu", icon: Menu, active: sheet === "menu", onClick: () => setSheet("menu") },
  ];

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_-14px_rgba(16,24,40,0.2)] backdrop-blur-md sm:hidden"
      >
        <div className="flex h-14 items-stretch">
          {tabs.map(({ key, label, icon: Icon, href, active, onClick }) => {
            const inner = (
              <>
                <span className="relative grid h-7 w-12 place-items-center">
                  {active && (
                    // key: re-mount so the label smooths down again on each new tab
                    <span key={`${key}-${pathname}-${sheet}`} aria-hidden className="cart-label tab-label--on absolute inset-0 rounded-full border-2 border-white bg-brand/12 shadow-[0_4px_10px_-4px_rgba(16,24,40,0.35)]">
                      <span className="cart-label-flap" />
                    </span>
                  )}
                  <Icon className={`relative size-[19px] ${active ? "text-brand" : ""}`} />
                </span>
                <span className={`text-[10px] leading-none font-semibold ${active ? "text-snow" : ""}`}>{label}</span>
              </>
            );
            const cls = `flex flex-1 flex-col items-center justify-center gap-1 text-fog transition-colors active:scale-95 ${active ? "" : "hover:text-snow"}`;
            return href ? (
              <Link key={key} href={href} aria-current={active ? "page" : undefined} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={key} type="button" aria-haspopup="dialog" aria-expanded={active} onClick={onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      </nav>

      <LabelModal open={sheet === "custom"} onClose={() => setSheet(null)} labelledBy="tab-custom-title" placement="bottom" className="max-w-md p-4">
        <SheetHead id="tab-custom-title" title="Make your own" onClose={() => setSheet(null)} />
        <div className="space-y-1.5">
          {custom.map(({ href, icon: Icon, title, text, from }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 active:scale-[0.98]">
              <span className="pie-gradient grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl text-white shadow-sm shadow-brand/30">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{title}</span>
                <span className="block truncate text-xs text-fog">{text}</span>
              </span>
              <span className="shrink-0 text-right text-[11px] leading-tight text-fog">
                from
                <span className="block font-display text-sm font-bold text-snow">{formatINR(from!)}</span>
              </span>
            </Link>
          ))}
        </div>
        <Link href="/custom-stickers" className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-brand">
          All custom options <ChevronRight className="size-3.5" />
        </Link>
      </LabelModal>

      <LabelModal open={sheet === "menu"} onClose={() => setSheet(null)} labelledBy="tab-menu-title" placement="bottom" className="max-w-md p-4">
        <SheetHead id="tab-menu-title" title="Menu" onClose={() => setSheet(null)} />
        <button
          type="button"
          onClick={() => {
            setSheet(null);
            window.dispatchEvent(new Event("stickypie:search"));
          }}
          className="flex w-full items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm text-fog"
        >
          <Search className="size-4" /> Search stickers…
        </button>
        <p className="mt-4 mb-2 text-[11px] font-bold tracking-wider text-fog uppercase">Shop</p>
        <div className="flex flex-wrap gap-1.5">
          {MORE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold active:scale-95">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-4 mb-2 text-[11px] font-bold tracking-wider text-fog uppercase">Help</p>
        <div className="flex flex-wrap gap-1.5">
          {HELP_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-xs font-medium text-fog hover:bg-snow/5 active:scale-95">
              {l.label}
            </Link>
          ))}
        </div>
      </LabelModal>
    </>
  );
}

function SheetHead({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 id={id} className="font-display text-lg font-bold">{title}</h2>
      <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full text-fog hover:bg-snow/5">
        <X className="size-4" />
      </button>
    </div>
  );
}
