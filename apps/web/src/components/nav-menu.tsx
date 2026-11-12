"use client";

import Link from "@/components/page-link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import { useLiveCatalog } from "@/lib/live-catalog";
import { isListed, isPoster, isPosterPack } from "@/lib/poster";
import { POSTER_SURFACES, stickersForSurface } from "@/lib/surfaces";

const PEEL_OFF_MS = 360;
const EMPTY = { categories: [] as Category[], products: [] as Product[] };
// browse-client's wall and mini poster categories: never sticker categories
const POSTER_CATEGORIES = new Set(["poster-packs", "mini-posters"]);

type Item = { href: string; name: string; count: number; image: string | null; fallback: string | null };

const pic = (p: Product | undefined) => ({
  image: p ? p.tinyUrl ?? p.thumbUrl ?? p.imageUrl : null,
  // a small picture that never got built: the bigger one
  fallback: p ? p.thumbUrl ?? p.imageUrl : null,
});

/** Every poster page (car posters, 2027 calendars…), with how many it lists and a picture. */
function posterItems(products: Product[], categories: Category[]): Item[] {
  return POSTER_SURFACES.filter((s) => s.slug !== "wall-posters").flatMap((s) => {
    const list = stickersForSurface(s, products, categories).matched;
    if (!list.length) return [];
    // a single poster's picture reads better at this size than a whole wall
    const face = list.find((p) => !isPosterPack(p)) ?? list[0];
    return [{ href: `/${s.slug}`, name: s.name, count: list.length, ...pic(face) }];
  });
}

/** Every sticker category with stickers on sale, in the shop's order. */
function stickerItems(products: Product[], categories: Category[]): Item[] {
  const stickers = products.filter((p) => !isPoster(p) && isListed(p));
  return categories.flatMap((c) => {
    if (POSTER_CATEGORIES.has(c.slug)) return [];
    const list = stickers.filter((p) => p.categoryIds.includes(c.id));
    if (!list.length) return [];
    return [{ href: `/stickers/${c.slug}`, name: c.name, count: list.length, ...pic(list[0]) }];
  });
}

/**
 * A header item with a drop-down of its categories: Wall posters lists every
 * poster page, Stickers every sticker category. The label still opens the
 * page; a mouse opens the menu on hover, a touch screen with the arrow.
 */
export default function NavMenu({ kind, href, label, active }: { kind: "posters" | "stickers"; href: string; label: string; active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const hoverClose = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef("");
  // how far left the menu moves so it ends 16px inside the screen (tablets)
  const [shift, setShift] = useState(0);
  const { products, categories } = useLiveCatalog(EMPTY);

  useEffect(() => {
    if (!open || !root.current) return;
    const width = Math.min(544, window.innerWidth - 32);
    const left = root.current.getBoundingClientRect().left;
    setShift(Math.min(0, window.innerWidth - 16 - (left + width)));
  }, [open]);

  useEffect(() => {
    if (open) return setShown(true);
    const t = setTimeout(() => setShown(false), PEEL_OFF_MS);
    return () => clearTimeout(t);
  }, [open]);

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

  // worked out only while the menu shows, not on every page render
  const items = useMemo(
    () => (shown || open ? (kind === "posters" ? posterItems(products, categories) : stickerItems(products, categories)) : []),
    [shown, open, kind, products, categories]
  );

  const hover = (e: React.PointerEvent, enter: boolean) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverClose.current);
    if (enter) setOpen(true);
    else hoverClose.current = setTimeout(() => setOpen(false), 160);
  };

  const pill = active || open ? "bg-snow/[0.07] text-snow shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]" : "text-fog hover:bg-snow/5 hover:text-snow";

  return (
    <div ref={root} className="relative" onPointerEnter={(e) => hover(e, true)} onPointerLeave={(e) => hover(e, false)}>
      <div className={`flex items-center rounded-full transition-all ${pill}`}>
        <Link href={href} className="py-1.5 pl-2.5 text-sm font-medium whitespace-nowrap lg:pl-4">
          {label}
        </Link>
        <button
          type="button"
          aria-label={`${label} categories`}
          aria-haspopup="menu"
          aria-expanded={open}
          onPointerDown={(e) => (pointer.current = e.pointerType)}
          // a mouse already opened it on hover, so its click keeps it open
          onClick={() => setOpen((o) => (pointer.current === "mouse" ? true : !o))}
          className="grid h-8 place-items-center pr-2 pl-1 lg:pr-3"
        >
          <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {(open || shown) && (
        <div
          style={{ left: shift }}
          className={`absolute top-full z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] drop-shadow-[0_18px_24px_rgba(16,24,40,0.22)] ${open ? "" : "pointer-events-none"}`}>
          <div role="menu" className={`cart-label relative rounded-[20px] border-[3px] border-white bg-ink2 p-1.5 ${open ? "panel-label--on" : "panel-label--off"}`}>
            <span aria-hidden className="cart-label-flap" />
            <div className="grid max-h-[min(28rem,70vh)] grid-cols-2 gap-0.5 overflow-y-auto overscroll-contain">
              {items.length === 0 && <p className="col-span-2 px-3 py-4 text-center text-sm text-fog">Loading…</p>}
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  role="menuitem"
                  className={`group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${pathname === it.href ? "bg-brand/[0.07]" : "hover:bg-snow/5"}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-snow/5">
                    {it.image && <img
                        src={it.image}
                        onError={(e) => {
                          if (it.fallback && e.currentTarget.src !== it.fallback) e.currentTarget.src = it.fallback;
                        }}
                        alt="" loading="lazy" decoding="async" className="size-full object-contain p-0.5 transition-transform group-hover:scale-110" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-snow">{it.name}</span>
                    <span className="block text-[11px] text-fog">{it.count} {kind === "posters" ? "designs" : "stickers"}</span>
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href={href}
              role="menuitem"
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border-t border-line/70 px-2.5 py-2 text-xs font-semibold text-brand hover:bg-brand/[0.06]"
            >
              <LayoutGrid className="size-3.5" /> All {label.toLowerCase()}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
