"use client";

import Link from "@/components/page-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import { useShopper } from "@/lib/shopper-auth";
import { useCart } from "./cart-context";
import SearchSpotlight from "./search-spotlight";
import CustomMenu from "./custom-menu";
import BackButton from "./back-button";
import { useFeatures } from "@/lib/live-catalog";

// Pages with a Back button in the header, and where it goes on a direct visit.
const BACK_PAGES: Record<string, string> = {
  "/custom-stickers": "/",
  "/custom-stickers/design": "/custom-stickers",
  "/avatar-stickers": "/",
  "/name-stickers": "/custom-stickers",
  "/qr-code-stickers": "/custom-stickers",
  "/checkout": "/stickers",
};

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count, openCart } = useCart();
  const shopper = useShopper();
  const pathname = usePathname();
  // Custom makers and checkout: a Back button (to wherever the shopper came from) in
  // place of the logo on phones only; bigger screens keep the logo.
  const backTo = BACK_PAGES[pathname];
  const backPage = Boolean(backTo);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⌘K / Ctrl K, or "/" outside a text field, opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest(
        "input, textarea, select, [contenteditable]",
      );
      if (
        (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    // the phone tab bar's menu asks for search with this event
    const onAsk = () => setSearchOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("stickypie:search", onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("stickypie:search", onAsk);
    };
  }, []);

  const features = useFeatures();
  const navLink = (href: string, label: string, hideOnMobile = false) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:px-4 ${
          active
            ? "bg-snow/[0.07] text-snow shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]"
            : "text-fog hover:bg-snow/5 hover:text-snow"
        } ${hideOnMobile ? "hidden sm:block" : ""}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <header
        className={`shift-with-cart fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "border-b border-line/80 bg-ink/80 backdrop-blur-xl"
            : "bg-gradient-to-b from-white via-white/70 to-transparent"
        }`}
      >
        <div className="flex h-[60px] w-full items-center gap-2 px-3 sm:h-[72px] sm:gap-6 sm:px-8 lg:px-12">
          {backTo && (
            <span className="sm:hidden">
              <BackButton fallback={backTo} />
            </span>
          )}
          <Link
            href="/"
            className={`shrink-0 items-center gap-2.5 ${backPage ? "hidden sm:flex" : "flex"}`}
          >
            <span
              aria-hidden
              className="peel peel-gentle size-8 -rotate-6 sm:size-9 transition-transform duration-300 hover:rotate-0"
            >
              <span className="peel-face">
                <img
                  src="/icons/icon-192.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-8 rounded-[10px] sm:size-9 sm:rounded-[11px]"
                />
              </span>
              <span className="peel-flap-wrap">
                <span className="peel-flap block" />
              </span>
            </span>
            <span className="font-display text-[22px] leading-none font-semibold tracking-tight">
              Sticky<span className="text-logo">Pie</span>
            </span>
          </Link>

          {/* phones: these live in the bottom tab bar instead */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navLink("/", "Home", true)}
            {navLink("/stickers", "Stickers")}
            {/* your design, QR code and name & text in one drop-down */}
            {features.customStickers && <CustomMenu />}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Search stickers"
              onClick={() => setSearchOpen(true)}
              className="group/search flex h-9 items-center gap-2 rounded-full text-fog transition-colors hover:text-snow sm:h-10 md:w-56 md:border md:border-line md:bg-ink2/60 md:pr-2 md:pl-3 md:backdrop-blur-md md:hover:border-fog/40"
            >
              <span className="grid size-9 place-items-center rounded-full group-hover/search:bg-snow/5 md:size-auto md:group-hover/search:bg-transparent">
                <Search className="size-[18px]" />
              </span>
              <span className="hidden flex-1 text-left text-sm md:block">
                Search stickers…
              </span>
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold md:block">
                ⌘K
              </kbd>
            </button>

            {shopper.enabled && (
              <Link
                href="/account"
                aria-label={shopper.email ? "My orders" : "Sign in"}
                title={
                  shopper.email ? `My orders (${shopper.email})` : "Sign in"
                }
                className={`grid size-9 place-items-center rounded-full transition-colors sm:size-10 ${
                  shopper.email
                    ? "bg-brand/10 text-brand hover:bg-brand/15"
                    : "text-fog hover:bg-snow/5 hover:text-snow"
                }`}
              >
                <UserRound className="size-[18px]" />
              </Link>
            )}

            <button
              type="button"
              aria-label="Open cart"
              onClick={openCart}
              className={`relative flex h-9 items-center gap-2 rounded-full px-2.5 transition-all sm:h-10 sm:px-4 ${
                count > 0
                  ? "pie-gradient text-white shadow-lg shadow-brand/30 hover:brightness-110 active:scale-95"
                  : "border border-line bg-ink2/60 backdrop-blur-md hover:border-fog/40 hover:bg-panel"
              }`}
            >
              <ShoppingBag
                className={`size-[18px] ${count > 0 ? "text-white" : "text-snow"}`}
              />
              <span className="hidden text-sm font-semibold sm:block">
                Cart
              </span>
              {count > 0 && (
                <span
                  key={count}
                  className="absolute -top-1.5 -right-1.5 grid min-w-[19px] animate-pop place-items-center rounded-full bg-snow px-1 text-[10px] leading-[19px] font-bold text-white shadow-md"
                >
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      {/* outside the header: its blur would otherwise trap the fixed pop-up */}
      <SearchSpotlight open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
