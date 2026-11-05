"use client";

import { Children, useEffect, useLayoutEffect, useRef, useState } from "react";
import Row from "./row";
import { savedRailScroll } from "@/lib/scroll-memory";

/** Wall set cards are wider than sticker cards: a wall has many posters to see. */
export const WALL_CARD_WIDTH = "w-64 shrink-0 sm:w-72 md:w-80";

/**
 * A home rail that renders its cards only once it's near the screen; until
 * then it shows its title and a few plain card-sized blocks (no animation).
 * Once drawn, it holds only the cards that fit plus a few more, and adds more
 * as the shopper swipes along it — a rail of 30 isn't 30 cards in the page.
 */
const RAIL_STEP = 6;

export default function LazyRail({
  eager,
  wide = false,
  title,
  href,
  children,
}: {
  eager: boolean;
  /** Wall sets: bigger cards, so the posters on the wall can be seen. */
  wide?: boolean;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const cards = Children.toArray(children);
  const [shown, setShown] = useState(RAIL_STEP + 2);
  // While put away: the rail's height (held, so nothing below it moves — iOS
  // has no scroll anchoring) and how far it had been swiped.
  const away = useRef<{ height: number; left: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Drawn when within SHOW of the screen; put back to plain blocks when
    // further than HIDE — so only the rails around the screen hold cards.
    const SHOW = 700;
    const HIDE = 1600;
    const set = (next: boolean) =>
      setNear((was) => {
        if (was && !next) {
          const scroller = el.querySelector<HTMLElement>(".rail-scroller");
          away.current = { height: el.offsetHeight, left: scroller?.scrollLeft ?? 0 };
        }
        return next;
      });
    const show = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && set(true), {
      rootMargin: `${SHOW}px 0px`,
    });
    const hide = new IntersectionObserver((e) => e.every((x) => !x.isIntersecting) && set(false), {
      rootMargin: `${HIDE}px 0px`,
    });
    show.observe(el);
    hide.observe(el);
    // Backup for in-app browsers (e.g. Instagram) that hold observers back.
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const off = Math.max(r.top - window.innerHeight, -r.bottom, 0);
        if (off < SHOW) set(true);
        else if (off > HIDE) set(false);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      show.disconnect();
      hide.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Back near the screen: put the swipe back where it was.
  useLayoutEffect(() => {
    if (!near || !away.current) return;
    const scroller = box.current?.querySelector<HTMLElement>(".rail-scroller");
    if (scroller) scroller.scrollLeft = away.current.left;
    away.current = null;
  }, [near]);

  // Wide screens see more cards at once: start with a screenful plus a few —
  // and on a back visit, enough to reach where the shopper had swiped to.
  useEffect(() => {
    const back = savedRailScroll(title) ?? 0;
    setShown((n) => Math.max(n, Math.ceil((back + window.innerWidth) / 170) + 3));
  }, [title]);

  // Swiped near the end of what's drawn: draw the next few.
  useEffect(() => {
    const el = box.current;
    if (!near || !el || shown >= cards.length) return;
    const onScroll = (e: Event) => {
      const s = e.target as HTMLElement;
      if (!s.classList?.contains("rail-scroller")) return;
      if (s.scrollLeft + s.clientWidth * 2 > s.scrollWidth) setShown((n) => n + RAIL_STEP);
    };
    el.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => el.removeEventListener("scroll", onScroll, { capture: true });
  }, [near, shown, cards.length]);

  return (
    <div ref={box} style={{ minHeight: !near && away.current ? away.current.height : undefined }}>
      <Row title={title} href={href}>
        {near
          ? cards.slice(0, shown)
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} aria-hidden className={`${wide ? WALL_CARD_WIDTH : "w-[min(60vw,15rem)] shrink-0 sm:w-48 md:w-52"} overflow-hidden rounded-2xl border border-line bg-ink`}>
                <div className={`${wide ? "aspect-square" : "aspect-[4/5]"} bg-ink2`} />
                <div className={wide ? "h-[84px]" : "h-[100px]"} />
              </div>
            ))}
      </Row>
    </div>
  );
}
