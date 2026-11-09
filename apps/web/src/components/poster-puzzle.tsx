"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, Gift, Lightbulb, Puzzle, RotateCcw, Share2, ShoppingBag, X } from "lucide-react";
import { PUZZLE_PERCENT, couponDiscount, formatINR } from "@stickypie/shared";
import { useBackToClose } from "@/lib/back-close";
import { useFeatures } from "@/lib/live-catalog";
import { useLite, useSlowNetwork } from "@/lib/lite";
import { claimPuzzlePrize, usePuzzlePrize } from "@/lib/puzzle-prize";
import { endPuzzleBoot } from "@/lib/puzzle-boot";
import { finishTurn, usePuzzleTurn } from "@/lib/puzzle-turns";
import PageLink from "./page-link";
import { playHere, type PuzzleLaunch } from "@/lib/puzzle-launch";
import { puzzleShare, share } from "@/lib/share";

// Poster puzzle: any mini poster cut into a 3×3 grid. Cards and the poster page
// play a short loop (split → shuffle → solve itself → whole again); the game on
// the poster page shows the poster, shuffles it and lets the shopper swap tiles
// back, for 10% off one order. One picture for all nine tiles, so no extra download.

/** slots[tile] = the grid cell (0–8, row by row) that tile sits in. */
type Slots = number[];
export const SOLVED: Slots = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** The win's confetti: 28 pieces, fixed so every win looks lively but costs the same. */
const CONFETTI_COLOURS = ["#ef5a28", "#ffd23f", "#0b9e6b", "#3b82f6", "#ec4899", "#8b5cf6"];
const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
  return {
    x: Math.round(r(1) * 100),
    colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
    w: 6 + Math.round(r(2) * 6),
    h: 8 + Math.round(r(3) * 8),
    delay: Math.round(r(4) * 500),
    dur: 1700 + Math.round(r(5) * 900),
    spin: Math.round(360 + r(6) * 540),
    drift: Math.round((r(7) - 0.5) * 160),
  };
});

/** A random mix with at least 5 tiles out of place, so it never looks nearly done. */
function mixed(): Slots {
  for (;;) {
    const s = [...SOLVED];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (s.filter((slot, tile) => slot !== tile).length >= 5) return s;
  }
}

const isSolved = (s: Slots) => s.every((slot, tile) => slot === tile);

function swapped(s: Slots, a: number, b: number): Slots {
  const next = [...s];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

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

type Drag = { tile: number; dx: number; dy: number; over: number | null };

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
          transform: `translate(${(at % 3) * 100}%, ${Math.floor(at / 3) * 100}%)${held ? ` translate3d(${drag.dx}px, ${drag.dy}px, 0)` : ""} scale(${split ? (held ? 1.06 : up ? 0.98 : 0.94) : 1})`,
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
 * Play & win: the puzzle cards' main button (and the hero fan's): play the puzzle for 10% off (the poster page,
 * straight into the game) instead of Add to cart. Once won it says so.
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
  const prize = usePuzzlePrize();
  return (
    // opens the game right here (no page load); the link is for a new tab
    <PageLink
      href={`/sticker/${poster.slug}?finish=puzzle&puzzle=1`}
      onClick={(e) => playHere(e, poster)}
      className={`puzzle-ticket relative z-10 flex items-center justify-center gap-1.5 overflow-hidden rounded-xl text-white ${prize ? "puzzle-ticket--won" : ""} ${live ? "puzzle-live" : ""} ${className}`}
    >
      {prize ? <Check className="size-4 shrink-0" strokeWidth={3} /> : <Puzzle className="puzzle-cta-icon size-4 shrink-0" />}
      <span className={`font-bold whitespace-nowrap ${compact ? "text-[12px]" : "text-[13px]"}`}>
        {prize ? (compact ? "Unlocked" : "10% unlocked ·") : "Play & win"}
      </span>
      <span className={`puzzle-ticket-hl font-display font-bold whitespace-nowrap ${compact ? "text-[13px]" : "text-[15px]"}`}>
        {prize ? "Play ▸" : compact ? "10%" : "10% OFF"}
      </span>
      <span aria-hidden className="puzzle-strip-shine" />
    </PageLink>
  );
}

/** "9:30 pm tomorrow" style end time for the prize. */
function endsAt(ms: number): string {
  const end = new Date(ms);
  const time = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return end.toDateString() === new Date().toDateString() ? `${time} today` : `${time} tomorrow`;
}

/** "23:41:07" left on the prize, ticking every second. */
function useCountdown(until: number | null): string | null {
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
  onAddToCart,
  className = "",
}: {
  src: string;
  onPlay: () => void;
  price?: number;
  onAddToCart?: () => void;
  className?: string;
}) {
  const prize = usePuzzlePrize();
  const features = useFeatures();
  const left = useCountdown(prize);
  if (!features.posterPuzzle) return null;
  const off = price !== undefined ? price - couponDiscount(price, PUZZLE_PERCENT) : null;
  return (
    // the whole ticket opens the game; only Add to cart does something else
    <div
      onClick={onPlay}
      className={`puzzle-ticket puzzle-live relative flex max-w-md cursor-pointer overflow-hidden rounded-2xl text-left ${prize ? "puzzle-ticket--won" : ""} ${className}`}
    >
      {/* stub: the live puzzle */}
      <button
        type="button"
        aria-label={prize ? "Play the puzzle" : `Play the puzzle for ${PUZZLE_PERCENT}% off`}
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
              <span className="puzzle-ticket-hl">{PUZZLE_PERCENT}% OFF</span>
            </p>
            <p className="mt-1 text-[11px] text-white/85">
              Whole order · ends in <span className="font-bold tabular-nums">{left}</span>
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              {onAddToCart && off !== null && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart();
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-brand shadow-sm active:scale-95"
                >
                  <ShoppingBag className="size-3.5" /> Add ·{" "}
                  <span className="text-fog line-through">{formatINR(price!)}</span> {formatINR(off)}
                </button>
              )}
            </div>
          </>
        ) : (
          <button type="button" className="block w-full text-left">
            <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">Puzzle challenge</p>
            <p className="font-display text-[22px] leading-[1.05] font-bold">
              Fix this poster,
              <br />
              win <span className="puzzle-ticket-hl">{PUZZLE_PERCENT}% OFF</span>
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
  const features = useFeatures();
  const left = useCountdown(prize);
  if (!features.posterPuzzle) return null;
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={prize ? `${PUZZLE_PERCENT}% off unlocked, open the puzzle` : `Play the puzzle for ${PUZZLE_PERCENT}% off`}
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
            <span className="puzzle-ticket-hl font-display text-base font-bold">{PUZZLE_PERCENT}% OFF</span>
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
            <span className="puzzle-ticket-hl font-display text-base font-bold">{PUZZLE_PERCENT}% OFF</span>
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
        <span className="block text-[9px] font-bold tracking-[0.16em] uppercase opacity-70">{prize ? "Unlocked" : "Play & win"}</span>
        <span className="block font-display text-base font-bold">{PUZZLE_PERCENT}% OFF</span>
      </span>
    </button>
  );
}

type Phase = "look" | "mix" | "play" | "won";

/** Full-screen game: see the poster, it shuffles, tap two tiles to swap them until it's whole. */
export function PuzzleGame({
  open,
  onClose,
  src,
  name,
  aspectRatio,
  price,
  onAddToCart,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  name: string;
  aspectRatio: number | null;
  /** The poster's price for the size picked, shown with the prize taken off. */
  price?: number;
  /** Adds the poster (size picked on the page) to the cart. */
  onAddToCart?: () => void;
  /** The poster's slug: "Challenge a friend" shares its puzzle link. */
  slug?: string;
}) {
  const challenge = (solvedIn?: number) => slug && void share(puzzleShare({ slug, name, image: src }, solvedIn));
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("look");
  const [slots, setSlots] = useState<Slots>(SOLVED);
  const [picked, setPicked] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [prize, setPrize] = useState<number | null | "none">(null);
  const [round, setRound] = useState(0);
  const started = useRef(0);
  const [seconds, setSeconds] = useState(0);
  // feedback: tiles that just landed right, a hint, holding Peek to see the poster whole
  const [landed, setLanded] = useState<number[]>([]);
  const [hint, setHint] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const [peek, setPeek] = useState(false);
  const prizeNow = usePuzzlePrize();
  const prizeLeft = useCountdown(prizeNow);
  useBackToClose(open, onClose);

  // Stays mounted while the sheet peels off, like every pop-up in the shop.
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 520);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Each open (or "play again"): show it whole, then split and shuffle.
  useEffect(() => {
    if (!open) return;
    endPuzzleBoot(); // the page's still copy of this screen (lib/puzzle-boot.ts) goes
    setPhase("look");
    setSlots(SOLVED);
    setPicked(null);
    setMoves(0);
    setSeconds(0);
    setHints(0);
    setHint([]);
    const timers = [
      window.setTimeout(() => setPhase("mix"), 1600),
      window.setTimeout(() => setSlots(mixed()), 2000),
      window.setTimeout(() => {
        setPhase("play");
        started.current = Date.now();
      }, 2600),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open, round]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = window.setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [phase]);

  // Lock page scroll, close on Esc.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function tap(tile: number) {
    if (phase !== "play") return;
    if (picked === null) return setPicked(tile);
    if (picked === tile) return setPicked(null);
    swapTiles(picked, tile);
  }

  // Swipe: drag a tile onto another (or flick it toward a neighbour) to swap them.
  const board = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  function grab(tile: number, e: React.PointerEvent) {
    if (phase !== "play" || !e.isPrimary) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    // one update per screen frame, however fast the finger sends moves
    let last: PointerEvent | null = null;
    let frame = 0;
    const draw = () => {
      frame = 0;
      if (!last) return;
      const dx = last.clientX - start.x;
      const dy = last.clientY - start.y;
      setDrag({ tile, dx, dy, over: dropTarget(tile, last.clientX, last.clientY, dx, dy) });
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return;
      moved = true;
      last = ev;
      frame ||= requestAnimationFrame(draw);
    };
    const up = (ev: PointerEvent) => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (!moved) return tap(tile);
      if (ev.type === "pointercancel") return;
      const target = dropTarget(tile, ev.clientX, ev.clientY, ev.clientX - start.x, ev.clientY - start.y);
      if (target !== null) swapTiles(tile, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /** The tile a swipe lands on: the cell under the finger, else the neighbour it was flicked toward. */
  function dropTarget(tile: number, x: number, y: number, dx: number, dy: number): number | null {
    const rect = board.current?.getBoundingClientRect();
    if (!rect) return null;
    const from = slots[tile];
    const col = Math.floor(((x - rect.left) / rect.width) * 3);
    const row = Math.floor(((y - rect.top) / rect.height) * 3);
    let cell = col >= 0 && col < 3 && row >= 0 && row < 3 ? row * 3 + col : from;
    if (cell === from && Math.hypot(dx, dy) > 24) {
      const fc = from % 3;
      const fr = Math.floor(from / 3);
      if (Math.abs(dx) > Math.abs(dy)) cell = dx > 0 ? (fc < 2 ? from + 1 : from) : fc > 0 ? from - 1 : from;
      else cell = dy > 0 ? (fr < 2 ? from + 3 : from) : fr > 0 ? from - 3 : from;
    }
    return cell === from ? null : slots.indexOf(cell);
  }

  /** Shows one misplaced tile and the tile sitting in its place, pulsing. */
  function showHint() {
    if (phase !== "play") return;
    const tile = slots.findIndex((slot, t) => slot !== t);
    if (tile < 0) return;
    setHint([tile, slots.indexOf(tile)]);
    setHints((n) => n + 1);
    window.setTimeout(() => setHint([]), 1800);
  }

  function swapTiles(a: number, b: number) {
    const next = swapped(slots, a, b);
    setSlots(next);
    setPicked(null);
    setHint([]);
    setMoves((m) => m + 1);
    const right = [a, b].filter((t) => next[t] === t);
    if (right.length) {
      setLanded(right);
      window.setTimeout(() => setLanded([]), 650);
    }
    if (isSolved(next)) {
      setSeconds(Math.floor((Date.now() - started.current) / 1000));
      // let the last tile land, then close the gaps
      window.setTimeout(() => setPhase("won"), 450);
      claimPuzzlePrize().then((expires) => setPrize(expires ?? "none"));
    }
  }

  if (!shown || typeof document === "undefined") return null;
  const ratio = aspectRatio && aspectRatio > 0.3 && aspectRatio < 3 ? aspectRatio : 2 / 3;
  const split = phase === "mix" || phase === "play";
  const placed = slots.filter((slot, t) => slot === t).length;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Puzzle: ${name}`}
      style={{ "--peel-max": `${window.innerWidth + window.innerHeight}px` } as React.CSSProperties}
      className={`cart-label puzzle-screen fixed inset-0 z-[80] flex flex-col ${closing ? "screen-label--off pointer-events-none" : "screen-label--on"}`}
    >
      <span aria-hidden className="cart-label-flap" />
      {/* top bar: what this is, and the way out */}
      <div className="relative z-[1] flex items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
        <span className="puzzle-cta puzzle-live grid size-10 shrink-0 place-items-center rounded-xl text-white">
          <Puzzle className="puzzle-cta-icon size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.18em] text-brand uppercase">Puzzle challenge</p>
          <p className="truncate font-display text-base leading-tight font-bold">{name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close puzzle"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-fog shadow-sm ring-1 ring-line transition-colors hover:text-snow"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* the board takes whatever room the controls leave, on any screen (see .puzzle-board-col) */}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:gap-10">
        {/* the board, on a frame */}
        <div className="puzzle-board-col flex min-h-0 w-full flex-1 basis-0 flex-col items-center justify-center gap-2 sm:h-full" style={{ "--ratio": ratio } as React.CSSProperties}>
          {/* placed tiles, as nine dots, and how it's going */}
          <div className="puzzle-fit flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-label={`${placed} of 9 tiles in place`}>
              {SOLVED.map((t) => (
                <span key={t} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${phase === "play" || phase === "won" ? (slots[t] === t ? "bg-[#0b9e6b]" : "bg-snow/10") : "bg-snow/10"}`} />
              ))}
            </div>
            <span className="shrink-0 text-xs font-bold text-snow tabular-nums">{phase === "play" || phase === "won" ? placed : 0}/9</span>
          </div>

          <div className="puzzle-frame puzzle-fit relative rounded-2xl p-2.5 sm:p-3">
            <div className="relative w-full" style={{ aspectRatio: ratio }}>
              <div ref={board} className={`absolute inset-0 transition-transform duration-500 ${phase === "won" ? "puzzle-won" : ""}`}>
                <Tiles
                  src={src}
                  slots={slots}
                  split={split}
                  picked={picked}
                  drag={drag}
                  trim
                  marks={phase === "play"}
                  hint={hint}
                  landed={landed}
                  onGrab={phase === "play" ? grab : undefined}
                  onKeyTap={phase === "play" ? tap : undefined}
                />
              </div>
              {/* holding Peek: the poster whole, over the board */}
              <img
                src={src}
                alt=""
                aria-hidden
                className={`pointer-events-none absolute inset-0 z-10 size-full rounded-[3px] object-cover transition-opacity duration-200 ${peek ? "opacity-100" : "opacity-0"}`}
              />
              {/* the start: remember it, then 3-2-1 while it mixes */}
              {(phase === "look" || phase === "mix") && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span key={phase} className="puzzle-count rounded-2xl bg-snow/80 px-4 py-2 text-center text-white backdrop-blur-sm">
                    <span className="block font-display text-lg font-bold">{phase === "look" ? "Remember it!" : "Mixing…"}</span>
                    <span className="block text-[11px] text-white/80">{phase === "look" ? "It's about to shuffle" : "Get ready"}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* phones: no instruction line (it crowded the stats); moving tiles explain themselves */}
        </div>

        {/* side panel (under the board on phones): stats, tools, the prize */}
        <div className="flex w-full max-w-[26rem] shrink-0 flex-col gap-2 sm:w-72 sm:gap-2.5">
          {/* wider screens: how to play sits here, beside the board */}
          <p className="hidden text-sm leading-snug font-semibold text-fog sm:block">
            {phase === "won" ? "Solved!" : picked === null ? "Swipe a tile onto another, or tap two tiles to swap them." : "Now tap (or swipe) the tile to swap with."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Time", value: `${seconds}s` },
              { label: "Swaps", value: moves },
              { label: "Hints", value: hints },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white px-2 py-1.5 text-center shadow-sm ring-1 ring-line">
                <p className="font-display text-lg leading-tight font-bold text-snow tabular-nums">{stat.value}</p>
                <p className="text-[10px] font-semibold tracking-wider text-fog uppercase">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={phase !== "play"}
              // hold: shows while pressed (pointer capture keeps it up if the finger drifts off)
              onPointerDown={(e) => {
                setPeek(true);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // not a live pointer (e.g. a synthetic event): the peek still shows
                }
              }}
              onPointerUp={() => setPeek(false)}
              onPointerCancel={() => setPeek(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-snow shadow-sm ring-1 ring-line select-none active:scale-95 disabled:opacity-50"
            >
              <Eye className="size-4" /> Hold to peek
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={phase !== "play"}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-snow shadow-sm ring-1 ring-line active:scale-95 disabled:opacity-50"
            >
              <Lightbulb className="size-4 text-gold" /> Hint
            </button>
          </div>
          {/* the prize waiting at the end */}
          <div className={`puzzle-ticket puzzle-live relative flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-white ${prizeNow ? "puzzle-ticket--won" : ""}`}>
            <Gift className="size-5 shrink-0" />
            <p className="min-w-0 flex-1 text-[13px] leading-tight font-bold">
              {prizeNow ? (
                <>Your <span className="puzzle-ticket-hl">{PUZZLE_PERCENT}% OFF</span> is active · ends in {prizeLeft}</>
              ) : (
                <>Solve it to unlock <span className="puzzle-ticket-hl">{PUZZLE_PERCENT}% OFF</span> your order</>
              )}
            </p>
            <span aria-hidden className="puzzle-strip-shine" />
          </div>
          <div className="flex items-center justify-center gap-4">
            {slug && (
              <button type="button" onClick={() => challenge()} className="flex h-9 items-center gap-1.5 text-xs font-bold text-brand hover:underline">
                <Share2 className="size-3.5" /> Challenge a friend
              </button>
            )}
            <button
              type="button"
              onClick={() => setRound((r) => r + 1)}
              disabled={phase !== "play"}
              className="hidden h-9 items-center gap-1.5 text-xs font-bold text-fog hover:text-brand disabled:opacity-40 sm:flex"
            >
              <RotateCcw className="size-3.5" /> Shuffle again
            </button>
          </div>
        </div>
      </div>

      {phase === "won" && (
        <div className="dialog-backdrop puzzle-won-wait absolute inset-0 z-10 grid place-items-center overflow-hidden bg-snow/50 p-4 backdrop-blur-[2px]">
          {/* confetti over the whole screen: falls once (transform / opacity only), then gone */}
          <span aria-hidden className="puzzle-confetti pointer-events-none absolute inset-0">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                style={{ left: `${c.x}%`, background: c.colour, width: c.w, height: c.h, animationDelay: `${c.delay}ms`, animationDuration: `${c.dur}ms`, "--spin": `${c.spin}deg`, "--drift": `${c.drift}px` } as React.CSSProperties}
              />
            ))}
          </span>
          <div className="puzzle-prize relative max-h-full w-full max-w-sm overflow-x-hidden overflow-y-auto rounded-3xl bg-white text-center shadow-2xl">
            {/* header: the solved poster drops onto a burst of light */}
            <div className="puzzle-win-head relative h-28">
              <span aria-hidden className="puzzle-win-rays absolute inset-0" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-3 right-3 z-[1] grid size-9 place-items-center rounded-full bg-white/25 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>
              <span className="puzzle-win-poster absolute top-5 left-1/2 block w-[4.5rem] rounded-md bg-white p-1 shadow-[0_12px_26px_-8px_rgba(16,24,40,0.55)]" style={{ aspectRatio: ratio }}>
                <img src={src} alt="" className="size-full rounded-[3px] object-cover" />
                <span className="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-full bg-[#0b9e6b] text-white shadow-md ring-2 ring-white">
                  <Check className="size-4" strokeWidth={3.5} />
                </span>
              </span>
            </div>
            <div className="px-5 pt-12 pb-5">
              <p className="puzzle-win-up font-display text-2xl leading-tight font-bold" style={{ animationDelay: "0.9s" }}>
                {seconds && seconds < 20 ? "Lightning fast! ⚡" : seconds && seconds < 45 ? "Puzzle solved! 🎉" : "You did it! 🎉"}
              </p>
              <div className="puzzle-win-up mt-2.5 flex justify-center gap-1.5" style={{ animationDelay: "1s" }}>
                {[
                  { label: "time", value: `${seconds}s` },
                  { label: "swaps", value: moves },
                  { label: "hints", value: hints },
                ].map((stat) => (
                  <span key={stat.label} className="rounded-full bg-panel px-2.5 py-1 text-xs text-fog">
                    <b className="font-display text-sm text-snow">{stat.value}</b> {stat.label}
                  </span>
                ))}
              </div>
              {prize === null ? (
                <p className="mt-4 h-[5.25rem] text-sm text-fog">Unlocking your prize…</p>
              ) : prize === "none" ? (
                <p className="mt-4 text-sm text-fog">The {PUZZLE_PERCENT}% offer has ended, but the poster still looks great.</p>
              ) : (
                // the prize as a coupon: notched, stamped
                <div className="puzzle-win-up puzzle-ticket puzzle-ticket--won puzzle-win-coupon relative mt-4 overflow-hidden rounded-2xl px-4 py-3 text-left text-white" style={{ animationDelay: "1.1s" }}>
                  <span aria-hidden className="puzzle-stamp absolute top-2.5 right-3" style={{ animationDelay: "1.5s" }}>
                    Unlocked
                  </span>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">Your prize</p>
                  <p className="font-display text-[26px] leading-none font-bold">
                    <span className="puzzle-ticket-hl">{PUZZLE_PERCENT}% OFF</span>
                  </p>
                  {price !== undefined && (
                    <p className="mt-1.5 text-sm">
                      This puzzle poster <span className="line-through opacity-70">{formatINR(price)}</span>{" "}
                      <b className="font-display text-lg">{formatINR(price - couponDiscount(price, PUZZLE_PERCENT))}</b>
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-white/80">Whole order · at checkout by itself · until {endsAt(prize)}</p>
                </div>
              )}
              {onAddToCart && prize !== "none" ? (
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart();
                    onClose();
                  }}
                  className="peel-btn mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold"
                >
                  <ShoppingBag className="peel-icon size-5" /> Add to cart
                  {typeof prize === "number" && price !== undefined ? ` · ${formatINR(price - couponDiscount(price, PUZZLE_PERCENT))}` : ""}
                </button>
              ) : (
                <button type="button" onClick={onClose} className="peel-btn mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-bold">
                  Back to the poster
                </button>
              )}
              {slug && (
                <button
                  type="button"
                  onClick={() => challenge(seconds || undefined)}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand/30 bg-brand/5 text-sm font-bold text-brand"
                >
                  <Share2 className="size-4" /> Challenge friends · beat my {seconds}s
                </button>
              )}
              {/* two full-size buttons: easy to hit with a thumb */}
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold text-snow">
                <button type="button" onClick={() => setRound((r) => r + 1)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-panel hover:text-brand">
                  <RotateCcw className="size-4" /> Play again
                </button>
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-xl bg-panel hover:text-brand">
                  Keep browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
