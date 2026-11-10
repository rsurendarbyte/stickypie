"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Puzzle } from "lucide-react";
import { couponDiscount, formatINR } from "@stickypie/shared";
import { useFeatures, usePuzzlePercent } from "@/lib/live-catalog";
import { useLite, useSlowNetwork } from "@/lib/lite";
import { usePuzzlePrize } from "@/lib/puzzle-prize";
import { SOLVED, isSolved, mixFrom, swapped, type Slots } from "@/lib/puzzle-round";
import { finishTurn, usePuzzleTurn } from "@/lib/puzzle-turns";
import PageLink from "./page-link";
import { playHere, puzzleHref, type PuzzleLaunch } from "@/lib/puzzle-launch";

// Poster puzzle: any mini poster cut into a 3×3 grid. Cards and the poster page
// play a short loop (split → shuffle → solve itself → whole again); the game on
// the poster page shows the poster, shuffles it and lets the shopper swap tiles
// back, for a prize off its puzzle posters. One picture for all nine tiles, so no extra download.

/** slots[tile] = the grid cell (0–8, row by row) that tile sits in (see lib/puzzle-round). */
export { SOLVED };

/** A random mix (decorative loops; the game mixes from its server round). */
export const mixed = (): Slots => mixFrom(Math.random);

/** The swaps that put a mix back in order, each one settling a tile. */
function solveSteps(start: Slots): [number, number][] {
  const steps: [number, number][] = [];
  let s = start;
  for (let tile = 0; tile < s.length; tile++) {
    if (s[tile] === tile) continue;
    const other = s.indexOf(tile);
    steps.push([tile, other]);
    s = swapped(s, tile, other);
  }
  return steps;
}

/**
 * Share of the picture trimmed off each edge inside the tiles: poster pictures
 * have rounded corners drawn in, which would give the four corner tiles away.
 */
const EDGE = 0.035;
const ZOOM = 1 / (1 - 2 * EDGE);

export type Drag = { tile: number; dx: number; dy: number; over: number | null };

/** The nine tiles, each showing its part of the poster, sitting in `slots`. */
export function Tiles({
  src,
  slots,
  split,
  lit = [],
  picked = null,
  drag = null,
  onGrab,
  onKeyTap,
  trim = split,
  marks = false,
  hint = [],
  landed = [],
}: {
  src: string;
  slots: Slots;
  split: boolean;
  lit?: number[];
  picked?: number | null;
  /** The tile under the finger, moved this far (px) from its cell; `over` = the tile it would swap with. */
  drag?: Drag | null;
  /** Finger or mouse down on a tile: tap or swipe (see PuzzleGame). */
  onGrab?: (tile: number, e: React.PointerEvent) => void;
  /** Keyboard (Enter / Space) on a tile: same as a tap. */
  onKeyTap?: (tile: number) => void;
  /** Trim the picture's rounded edge (see EDGE); by default only while split, so the loop starts and ends on the real picture. */
  trim?: boolean;
  /** The game: a tick on every tile in its right place. */
  marks?: boolean;
  /** Tiles pulsing as a hint (a tile and the one in its place). */
  hint?: number[];
  /** Tiles that just landed in their right place: a quick pop. */
  landed?: number[];
}) {
  const zoom = trim ? ZOOM : 1;
  const edge = trim ? EDGE : 0;
  return (
    <>
      {slots.map((slot, tile) => {
        const held = drag?.tile === tile;
        // the tile it would swap with already slides into the held tile's spot, as a preview
        const making = drag && drag.over === tile;
        const at = making ? slots[drag.tile] : slot;
        const up = lit.includes(tile) || picked === tile || held;
        const style = {
          transform: `translate(${(at % 3) * 100}%, ${Math.floor(at / 3) * 100}%)${held ? ` translate3d(${drag.dx}px, ${drag.dy}px, 0)` : ""} scale(${split ? (held ? 1.06 : up ? 0.995 : 0.98) : 1})`,
          zIndex: held ? 3 : up ? 2 : 1,
          // the held tile follows the finger exactly; the rest glide
          transitionDuration: held ? "0ms" : making ? "220ms" : undefined,
          willChange: drag ? "transform" : undefined,
        };
        const right = marks && split && slot === tile && !held;
        const face = (
          <span
            className={`relative block size-full overflow-hidden transition-[border-radius,box-shadow] duration-300 ${
              split ? "rounded-[3px] shadow-[0_3px_10px_rgba(16,24,40,0.28)]" : ""
            } ${up ? "ring-2 ring-white" : right ? "ring-2 ring-[#0b9e6b]/80" : ""} ${held ? "shadow-[0_14px_30px_-6px_rgba(16,24,40,0.45)]" : ""} ${
              hint.includes(tile) ? "puzzle-hint" : ""
            } ${landed.includes(tile) ? "puzzle-landed" : ""}`}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute max-w-none object-cover select-none"
              style={{
                width: `${300 * zoom}%`,
                height: `${300 * zoom}%`,
                left: `${-((tile % 3) + 3 * edge * zoom) * 100}%`,
                top: `${-(Math.floor(tile / 3) + 3 * edge * zoom) * 100}%`,
              }}
            />
            {right && (
              <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-[#0b9e6b] text-white shadow-sm">
                <Check className="size-2.5" strokeWidth={4} />
              </span>
            )}
          </span>
        );
        const cls = "absolute top-0 left-0 h-1/3 w-1/3 transition-transform duration-500 ease-[cubic-bezier(0.3,1.25,0.5,1)]";
        return onGrab ? (
          <button
            key={tile}
            type="button"
            aria-label={`Tile ${tile + 1}`}
            onPointerDown={(e) => onGrab(tile, e)}
            // pointer taps are handled on release; a click with no pointer is the keyboard
            onClick={(e) => e.detail === 0 && onKeyTap?.(tile)}
            className={`${cls} touch-none select-none`}
            style={style}
          >
            {face}
          </button>
        ) : (
          <span key={tile} className={cls} style={style}>
            {face}
          </span>
        );
      })}
    </>
  );
}

/** Where an object-contain <img> actually draws its picture, inside its offset parent. */
function useDrawnBox(img: HTMLImageElement | null) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!img) return;
    const measure = () => {
      if (!img.complete || img.naturalWidth === 0) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      const w = Math.min(img.offsetWidth, img.offsetHeight * ratio);
      const h = w / ratio;
      setBox({ left: img.offsetLeft + (img.offsetWidth - w) / 2, top: img.offsetTop + (img.offsetHeight - h) / 2, width: w, height: h });
    };
    measure();
    img.addEventListener("load", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => {
      img.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [img]);
  return box;
}

/** Heavy effects are off (slow phone or reduced motion); a slow network alone keeps them. */
function useNoEffects() {
  // both hooks every render (a short-circuit would skip one and break React's hook order)
  const lite = useLite();
  const slowNet = useSlowNetwork();
  return lite && !slowNet;
}

/**
 * The self-solving loop laid over a poster picture: covers its parent, or the
 * drawn area of `img` when given. Plays only on its turn (one poster at a time);
 * between turns nothing is drawn, so the real picture shows.
 */
export function PuzzleLoop({
  src,
  img,
  priority = false,
  once = false,
}: {
  src: string;
  img?: HTMLImageElement | null;
  priority?: boolean;
  /** Play one loop and stop (the phone swipe view, where the poster is the whole screen). */
  once?: boolean;
}) {
  const features = useFeatures();
  const noEffects = useNoEffects();
  const box = useDrawnBox(img ?? null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [played, setPlayed] = useState(false);
  // "once" stops after one loop; switching to a repeating loop (Puzzle picked) starts it again
  const enabled = features.posterPuzzle && !noEffects && !(once && played) && (img === undefined || box !== null);
  const { id, active } = usePuzzleTurn(el, enabled, priority);
  const [run, setRun] = useState<{ slots: Slots; split: boolean; lit: number[] } | null>(null);

  useEffect(() => {
    if (!active) {
      setRun(null);
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const mix = mixed();
    setRun({ slots: SOLVED, split: false, lit: [] });
    at(300, () => setRun({ slots: SOLVED, split: true, lit: [] }));
    at(750, () => setRun({ slots: mix, split: true, lit: [] }));
    let t = 1500;
    let s = mix;
    for (const [a, b] of solveSteps(mix)) {
      const before = s;
      const after = swapped(s, a, b);
      at(t, () => setRun({ slots: before, split: true, lit: [a, b] }));
      at(t + 200, () => setRun({ slots: after, split: true, lit: [a, b] }));
      s = after;
      t += 460;
    }
    at(t, () => setRun({ slots: SOLVED, split: true, lit: [] }));
    at(t + 250, () => setRun({ slots: SOLVED, split: false, lit: [] }));
    at(t + 1000, () => {
      finishTurn(id);
      if (once) setPlayed(true);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [active, id, once]);

  const running = run !== null;
  // The real picture hides while the tiles are out, or it shows through the gaps (see globals.css).
  useEffect(() => {
    const parent = el?.parentElement;
    if (!parent || !running) return;
    parent.dataset.puzzling = "";
    return () => {
      delete parent.dataset.puzzling;
    };
  }, [el, running]);

  if (!features.posterPuzzle || noEffects) return null;
  return (
    <div
      ref={setEl}
      aria-hidden
      // isolate: the tiles' own layer order stays inside, never over buttons beside the poster
      className="pointer-events-none absolute isolate"
      style={img !== undefined ? (box ?? { inset: 0 }) : { inset: 0 }}
    >
      {run && <Tiles src={src} slots={run.slots} split={run.split} lit={run.lit} />}
    </div>
  );
}

/**
 * A puzzle card's still picture: the poster as one image with cut lines over it
 * (two elements instead of nine tiles); a PuzzleLoop beside it hides both while
 * the tiles are out.
 */
export function SplitPicture({ src }: { src: string }) {
  return (
    <>
      {/* absolute: its own pixel size mustn't stretch the poster-shaped box it fills */}
      <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full rounded-[4px] object-cover shadow-[0_6px_16px_-8px_rgba(16,24,40,0.45)]" />
      <span aria-hidden className="puzzle-cuts absolute inset-0" />
    </>
  );
}

/**
 * The poster shown as its 9 puzzle cards (still, split apart), laid over the
 * drawn picture: what a puzzle poster looks like, when Puzzle is picked.
 */
export function PuzzleSplit({ src, img }: { src: string; img: HTMLImageElement | null }) {
  const box = useDrawnBox(img);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // the real picture hides behind the cards (see globals.css); a solve loop on
  // top hides these in turn while its own tiles are out
  useEffect(() => {
    const parent = el?.parentElement;
    if (!parent || !box) return;
    parent.dataset.split = "";
    return () => {
      delete parent.dataset.split;
    };
  }, [el, box]);
  return (
    <div ref={setEl} aria-hidden className="puzzle-split pointer-events-none absolute isolate" style={box ?? { display: "none" }}>
      {box && <Tiles src={src} slots={SOLVED} split trim />}
    </div>
  );
}

/**
 * The label on a puzzle poster card: a little 3×3 grid (the 9 cards) and what it is.
 * Static, so it costs nothing in a feed.
 */
export function PuzzleTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg bg-white/95 py-1 pr-2 pl-1 shadow-[0_4px_12px_-4px_rgba(16,24,40,0.3)] ring-1 ring-black/5 ${className}`}>
      <span aria-hidden className="puzzle-cta grid size-[18px] grid-cols-3 gap-px rounded-[5px] p-[3px]">
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} className={`rounded-[1px] ${i === 4 ? "bg-[#ffd23f]" : "bg-white/90"}`} />
        ))}
      </span>
      <span className="text-[10px] leading-none font-bold tracking-wide text-snow uppercase">Puzzle</span>
      <span className="text-[10px] leading-none font-semibold text-fog">9 pcs</span>
    </span>
  );
}

/**
 * Play & win: the puzzle cards' main button (and the hero fan's): play the puzzle for the prize (the game's
 * own page) instead of Add to cart. It keeps inviting a game after a win too.
 */
export function PuzzlePlayLink({
  poster,
  className = "",
  compact = false,
  live = false,
}: {
  poster: PuzzleLaunch;
  className?: string;
  /** Short words, for a narrow spot (the hero's half-width card on phones). */
  compact?: boolean;
  /** Shine and wiggle: only for the few hero / page buttons, never every card. */
  live?: boolean;
}) {
  const pct = usePuzzlePercent();
  return (
    // the game's own page (playHere keeps the tap from also opening the card around it)
    <PageLink
      href={puzzleHref(poster.slug)}
      onClick={(e) => playHere(e, poster)}
      className={`puzzle-ticket relative z-10 flex items-center justify-center gap-1.5 overflow-hidden rounded-xl text-white ${live ? "puzzle-live" : ""} ${className}`}
    >
      <Puzzle className="puzzle-cta-icon size-4 shrink-0" />
      <span className={`font-bold whitespace-nowrap ${compact ? "text-[12px]" : "text-[13px]"}`}>Play &amp; win</span>
      <span className={`puzzle-ticket-hl font-display font-bold whitespace-nowrap ${compact ? "text-[13px]" : "text-[15px]"}`}>
        {compact ? `${pct}%` : `${pct}% OFF`}
      </span>
      <span aria-hidden className="puzzle-strip-shine" />
    </PageLink>
  );
}

/** "9:30 pm tomorrow" style end time for the prize. */
export function endsAt(ms: number): string {
  const end = new Date(ms);
  const time = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return end.toDateString() === new Date().toDateString() ? `${time} today` : `${time} tomorrow`;
}

/** "23:41:07" left on the prize, ticking every second. */
export function useCountdown(until: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, Math.floor((until - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
}

/**
 * A tiny copy of this poster as a puzzle that keeps solving itself, one swap at a
 * time, then mixes up again. Only moves while on screen; still in lite mode.
 */
function MiniPuzzle({ src, solved = false }: { src: string; solved?: boolean }) {
  const noEffects = useNoEffects();
  const box = useRef<HTMLSpanElement>(null);
  const [slots, setSlots] = useState<Slots>([4, 0, 2, 3, 8, 5, 6, 7, 1]);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || noEffects) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [noEffects]);
  useEffect(() => {
    if (solved) return setSlots(SOLVED);
    if (!seen) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setSlots((s) => {
        if (isSolved(s)) return mixed();
        const [a, b] = solveSteps(s)[0];
        return swapped(s, a, b);
      });
    }, 900);
    return () => window.clearInterval(t);
  }, [seen, solved]);
  return (
    <span ref={box} className="relative block aspect-[2/3] w-full">
      <Tiles src={src} slots={slots} split={!solved} trim />
    </span>
  );
}

/**
 * The poster page's puzzle offer, drawn as a coupon ticket: a live mini puzzle of
 * this poster on the stub, the offer on the ticket, a perforated tear line between.
 * Once won it turns into a stamped coupon with a countdown and the price with 10% off.
 */
export function PuzzleTicket({
  src,
  onPlay,
  price,
  className = "",
}: {
  src: string;
  onPlay: () => void;
  price?: number;
  className?: string;
}) {
  const prize = usePuzzlePrize();
  const pct = usePuzzlePercent();
  const features = useFeatures();
  const left = useCountdown(prize);
  if (!features.posterPuzzle) return null;
  const off = price !== undefined ? price - couponDiscount(price, pct) : null;
  return (
    // the whole ticket opens the game
    <div
      onClick={onPlay}
      className={`puzzle-ticket puzzle-live relative flex max-w-md cursor-pointer overflow-hidden rounded-2xl text-left ${prize ? "puzzle-ticket--won" : ""} ${className}`}
    >
      {/* stub: the live puzzle */}
      <button
        type="button"
        aria-label={prize ? "Play the puzzle" : `Play the puzzle for ${pct}% off`}
        className="relative w-[5.6rem] shrink-0 bg-white/15 p-3"
      >
        <span className="block -rotate-3 rounded-[4px] bg-white p-[3px] shadow-[0_6px_14px_-4px_rgba(16,24,40,0.45)]">
          <MiniPuzzle src={src} solved={prize !== null} />
        </span>
      </button>
      {/* perforated tear line, with the ticket's notches */}
      <span aria-hidden className="puzzle-ticket-tear" />
      {/* ticket */}
      <div className="relative min-w-0 flex-1 py-3 pr-3 pl-3.5 text-white">
        {prize ? (
          <>
            <span aria-hidden className="puzzle-stamp absolute top-2 right-2.5">
              Unlocked
            </span>
            <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">Your puzzle prize</p>
            <p className="font-display text-[26px] leading-none font-bold">
              <span className="puzzle-ticket-hl">{pct}% OFF</span>
            </p>
            <p className="mt-1 text-[11px] text-white/85">
              On puzzle posters · ends in <span className="font-bold tabular-nums">{left}</span>
            </p>
            {/* still a game: Play again (the page's own Add to cart sits right below) */}
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="inline-flex h-9 items-center gap-1 rounded-full bg-[#ffd23f] px-4 text-xs font-bold text-[#2a1a00] shadow-sm">
                Play ▸
              </span>
              {off !== null && (
                <span className="text-[11px] text-white/85">
                  <span className="line-through opacity-70">{formatINR(price!)}</span> <b className="text-white">{formatINR(off)}</b>
                </span>
              )}
            </div>
          </>
        ) : (
          <button type="button" className="block w-full text-left">
            <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">Puzzle challenge</p>
            <p className="font-display text-[22px] leading-[1.05] font-bold">
              Fix this poster,
              <br />
              win <span className="puzzle-ticket-hl">{pct}% OFF</span>
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[11px] text-white/85">
              <span>🧩 9 pieces</span>
              <span>⏱ ~30 sec</span>
              {off !== null && (
                <span>
                  <span className="line-through opacity-70">{formatINR(price!)}</span> <b>{formatINR(off)}</b>
                </span>
              )}
            </p>
            <span className="puzzle-ticket-play mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-brand shadow-sm">
              <Puzzle className="size-3.5" /> Play now
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Phone swipe view: the puzzle offer as a slim coupon strip on top of the buy bar
 * (live mini puzzle, the offer, Play), so it never covers the poster. Once won,
 * a green strip with the countdown.
 */
export function PuzzleStrip({ src, onPlay }: { src: string; onPlay: () => void }) {
  const prize = usePuzzlePrize();
  const pct = usePuzzlePercent();
  const features = useFeatures();
  const left = useCountdown(prize);
  if (!features.posterPuzzle) return null;
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={prize ? `${pct}% off unlocked, open the puzzle` : `Play the puzzle for ${pct}% off`}
      className={`puzzle-ticket puzzle-strip puzzle-live relative mb-2 flex h-10 w-full items-center gap-2 overflow-hidden rounded-xl pr-1.5 text-left text-white ${prize ? "puzzle-ticket--won" : ""}`}
    >
      <span className="grid h-full w-10 shrink-0 place-items-center bg-white/15">
        {prize ? (
          <Check className="size-5" strokeWidth={3} />
        ) : (
          <span className="block w-5 -rotate-6 rounded-[2px] bg-white p-px shadow-sm">
            <MiniPuzzle src={src} />
          </span>
        )}
      </span>
      <span aria-hidden className="puzzle-ticket-tear" />
      {prize ? (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate leading-none">
            <span className="puzzle-ticket-hl font-display text-base font-bold">{pct}% OFF</span>
            <span className="flex flex-col text-[11px] leading-tight font-bold">
              unlocked
              <span className="font-semibold text-white/80 tabular-nums">⏱ {left}</span>
            </span>
          </span>
          {/* still a game to play (for fun, or to challenge a friend) */}
          <span className="shrink-0 rounded-full bg-[#ffd23f] px-3.5 py-1.5 text-xs font-extrabold text-[#2a1a00] shadow-sm">Play ▸</span>
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate leading-none">
            <span className="text-[13px] font-bold">Fix it &amp; win</span>
            <span className="puzzle-ticket-hl font-display text-base font-bold">{pct}% OFF</span>
          </span>
          <span className="puzzle-ticket-play shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand">Play ▸</span>
        </>
      )}
      <span aria-hidden className="puzzle-strip-shine" />
    </button>
  );
}

/**
 * The little sticker on a poster's picture that opens the game: tilted like a
 * peel-off label, so it reads as something to play. Once won it's a "10% off" stamp.
 */
export function PuzzleButton({ onClick, src, className = "" }: { onClick: () => void; /** shows this poster as a live mini puzzle */ src?: string; className?: string }) {
  const prize = usePuzzlePrize();
  const pct = usePuzzlePercent();
  const features = useFeatures();
  if (!features.posterPuzzle) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`puzzle-sticker puzzle-live inline-flex -rotate-[4deg] items-center gap-2 rounded-xl py-1.5 pr-3 pl-1.5 text-left transition-transform active:scale-95 ${prize ? "puzzle-sticker--won" : ""} ${className}`}
    >
      {src && !prize ? (
        <span className="block w-7 shrink-0 rounded-[3px] bg-white p-[2px] shadow-[0_3px_8px_-2px_rgba(16,24,40,0.4)] ring-1 ring-black/5">
          <MiniPuzzle src={src} />
        </span>
      ) : (
        <span className="puzzle-cta-icon grid size-8 shrink-0 place-items-center rounded-lg">
          {prize ? <Check className="size-4" strokeWidth={3} /> : <Puzzle className="size-4" />}
        </span>
      )}
      <span className="leading-none">
        <span className="block text-[9px] font-bold tracking-[0.16em] uppercase opacity-70">Play &amp; win</span>
        <span className="block font-display text-base font-bold">{pct}% OFF</span>
      </span>
    </button>
  );
}
