"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrderAlertsToggle, useOrderAlerts } from "./order-alerts";
import { Inbox, LayoutDashboard, LayoutList, LogOut, Package, Settings, ShoppingCart, Star, Tags, ToggleRight } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/home-layout", label: "Home page", icon: LayoutList },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/messages", label: "Messages", icon: Inbox },
  { href: "/features", label: "Features", icon: ToggleRight },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  mode,
  userLabel,
  logout,
}: {
  mode: "demo" | "supabase";
  userLabel: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  // Paid orders waiting to be packed — a red count on Orders.
  const { count } = useOrderAlerts();
  const badge = (href: string, small = false) =>
    href === "/orders" && count > 0 ? (
      <span
        className={`ml-auto grid min-w-5 place-items-center rounded-full bg-brand px-1.5 font-bold text-white ${
          small ? "h-4 min-w-4 text-[9px]" : "h-5 text-[11px]"
        }`}
      >
        {count}
      </span>
    ) : null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-white/10 text-snow"
        : "text-fog hover:bg-white/5 hover:text-snow"
    }`;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-ink2 lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
          <div>
          <p className="font-display text-2xl leading-none font-semibold">
            Sticky<span className="text-logo">Pie</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-fog uppercase">
            Admin console
          </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="size-4.5" />
              {label}
              {badge(href)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <OrderAlertsToggle className="-mx-3 mb-3 w-[calc(100%+1.5rem)]" />
          <p className="truncate text-xs font-medium text-snow/90">{userLabel}</p>
          <p className="mt-1 text-[11px] text-fog">
            {mode === "demo" ? "Local demo store" : "Supabase connected"}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-semibold text-fog transition-colors hover:bg-white/5 hover:text-snow"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-line bg-ink2/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <img src="/icons/icon-192.png" alt="" width={28} height={28} className="size-7 rounded-lg" />
            Sticky<span className="-ml-2 text-logo">Pie</span>{" "}
            <span className="text-xs font-normal text-fog">admin</span>
          </p>
          <div className="flex items-center gap-1">
          <OrderAlertsToggle />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-full text-fog hover:bg-white/10"
            >
              <LogOut className="size-4" />
            </button>
          </form>
          </div>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium ${
                isActive(href) ? "bg-white/10 text-snow" : "text-fog"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {badge(href, true)}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
