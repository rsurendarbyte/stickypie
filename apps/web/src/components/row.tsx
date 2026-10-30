"use client";

import Link from "@/components/page-link";
import { Children, useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useRailScrollMemory } from "@/lib/scroll-memory";

export default function Row({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useRailScrollMemory(scroller, title, Children.count(children));

  function scrollByDir(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const arrow =
    "absolute top-[34%] z-10 hidden size-11 place-items-center rounded-full border border-line bg-ink text-snow/80 shadow-xl shadow-[rgba(16,24,40,0.18)] transition-all duration-200 hover:scale-105 hover:border-brand/50 hover:text-snow md:grid opacity-0 group-hover/row:opacity-100";

  return (
    <section className="group/row relative">
      <div className="flex w-full items-center gap-3 px-4 sm:px-8 lg:px-12 2xl:px-20">
        <span className="pie-gradient h-5 w-1 shrink-0 self-start rounded-full mt-px sm:self-center sm:mt-0" />
        <h2 className="line-clamp-2 min-w-0 font-display text-base leading-tight font-semibold tracking-tight sm:text-xl" title={title}>
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="peel-btn peel-btn--light ml-auto flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap sm:px-3.5"
          >
            <span className="max-sm:hidden">Explore </span>all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="relative w-full">
        <button type="button" aria-label="Scroll left" onClick={() => scrollByDir(-1)} className={`${arrow} left-3`}>
          <ChevronLeft className="size-6" />
        </button>
        <div
          ref={scroller}
          className="rail-scroller no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pt-3 pb-3 scroll-pl-4 sm:pt-4 sm:pb-5 sm:gap-4 sm:px-8 sm:scroll-pl-8 lg:px-12 lg:scroll-pl-12 2xl:px-20 2xl:scroll-pl-20"
        >
          {children}
        </div>
        <button type="button" aria-label="Scroll right" onClick={() => scrollByDir(1)} className={`${arrow} right-3`}>
          <ChevronRight className="size-6" />
        </button>
      </div>
    </section>
  );
}
