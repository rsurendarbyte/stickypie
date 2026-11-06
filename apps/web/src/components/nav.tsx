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
    const walls = pathname.startsWith("/stickers/poster-packs");
    const active = href === "/" ? pathname === "/" : href === "/stickers" ? pathname.startsWith(href) && !walls : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all lg:px-4 ${
          active
            ? "bg-snow/[0.07] text-snow shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]"
            : "text-fog hover:bg-snow/5 hover:text-snow"
        } ${hideOnMobile ? "hidden md:block" : ""}`}
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
        <div className="flex h-[60px] w-full items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-8 lg:gap-6 lg:px-12">
          {backTo && (
            <span className="sm:hidden">
              <BackButton fallback={backTo} />
            </span>
          )}
          <Link
            href="/"
            aria-label="StickyPie home"
            className={`shrink-0 items-center ${backPage ? "hidden sm:flex" : "flex"}`}
          >
            <span className="relative block aspect-[960/323] h-[50px] drop-shadow-[0_1px_2px_rgba(21,22,30,0.2)] sm:h-[60px]">
              <img
                src="/icons/logo-wide-base.webp"
                alt=""
                width={960}
                height={323}
                className="block size-full"
              />
              <span aria-hidden className="peel peel-gentle peel-logo">
                <span className="peel-face">
                  <img
                    src="/icons/logo-mark.webp"
                    alt=""
                    width={270}
                    height={267}
                    className="size-full"
                  />
                </span>
                <span className="peel-flap-wrap">
                  <span className="peel-flap block" />
                </span>
              </span>
            </span>
          </Link>

          {/* phones: these live in the bottom tab bar instead */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navLink("/", "Home", true)}
            {navLink("/stickers/poster-packs", "Wall posters")}
            {navLink("/stickers", "Stickers")}
            {/* your design, QR code and name & text in one drop-down */}
            {features.customStickers && <CustomMenu />}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Search stickers"
              onClick={() => setSearchOpen(true)}
              className="group/search flex h-9 items-center gap-2 rounded-full text-fog transition-colors hover:text-snow sm:h-10 lg:w-44 lg:border lg:border-line lg:bg-ink2/60 lg:pr-2 lg:pl-3 lg:backdrop-blur-md lg:hover:border-fog/40 xl:w-56"
            >
              <span className="grid size-9 place-items-center rounded-full group-hover/search:bg-snow/5 lg:size-auto lg:group-hover/search:bg-transparent">
                <Search className="size-[18px]" />
              </span>
              <span className="hidden flex-1 text-left text-sm whitespace-nowrap lg:block">
                Search stickers…
              </span>
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold xl:block">
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
              <span className="hidden text-sm font-semibold md:block">
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
