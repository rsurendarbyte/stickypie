"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useShopper } from "@/lib/shopper-auth";
import { useCart } from "./cart-context";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { count, openCart } = useCart();
  const shopper = useShopper();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
  }

  const navLink = (href: string, label: string, hideOnMobile = false) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
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
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-line/80 bg-ink/80 backdrop-blur-xl"
          : "bg-gradient-to-b from-white via-white/70 to-transparent"
      }`}
    >
      <div className="flex h-[72px] w-full items-center gap-2 px-3 sm:gap-6 sm:px-8 lg:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={36}
            height={36}
            className="size-9 -rotate-6 rounded-[11px] shadow-lg shadow-amber-500/30 transition-transform duration-300 hover:rotate-0"
          />
          <span className="font-display text-[22px] leading-none font-semibold tracking-tight">
            Sticky<span className="text-logo">Pie</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLink("/", "Home", true)}
          {navLink("/browse", "Browse")}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <form
            onSubmit={submitSearch}
            className={`flex items-center rounded-full border transition-all duration-300 ${
              searchOpen
                ? "w-52 border-line bg-ink2/80 pl-1 backdrop-blur-md focus-within:border-brand/60 focus-within:shadow-[0_0_0_3px_rgba(255,46,99,0.12)] sm:w-72"
                : "w-10 border-transparent"
            }`}
          >
            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Search stickers"}
              onClick={() => setSearchOpen((v) => !v)}
              className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
                searchOpen ? "text-brand" : "text-fog hover:bg-snow/5 hover:text-snow"
              }`}
            >
              {searchOpen ? <X className="size-[18px]" /> : <Search className="size-[18px]" />}
            </button>
            {searchOpen && (
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stickers…"
                className="h-10 w-full bg-transparent pr-4 text-sm outline-none placeholder:text-fog/50"
              />
            )}
          </form>

          {shopper.enabled && (
            <Link
              href="/account"
              aria-label={shopper.email ? "My orders" : "Sign in"}
              title={shopper.email ? `My orders (${shopper.email})` : "Sign in"}
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
            className={`relative flex h-10 items-center gap-2 rounded-full px-3 transition-all sm:px-4 ${
              count > 0
                ? "pie-gradient text-white shadow-lg shadow-brand/30 hover:brightness-110 active:scale-95"
                : "border border-line bg-ink2/60 backdrop-blur-md hover:border-fog/40 hover:bg-panel"
            }`}
          >
            <ShoppingBag className={`size-[18px] ${count > 0 ? "text-white" : "text-snow"}`} />
            <span className="hidden text-sm font-semibold sm:block">Cart</span>
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
  );
}
