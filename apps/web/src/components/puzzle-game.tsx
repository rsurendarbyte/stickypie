"use client";

// The full-screen poster puzzle game, split out of poster-puzzle.tsx so its code
// loads only when a shopper opens a game (PuzzleLauncher imports it lazily).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, Gift, Lightbulb, Puzzle, RotateCcw, Share2, ShoppingBag, X } from "lucide-react";
import { couponDiscount, formatINR } from "@stickypie/shared";
import { useBackToClose } from "@/lib/back-close";
import { usePuzzlePercent } from "@/lib/live-catalog";
import { claimPuzzlePrize, fetchPuzzleRound, usePuzzlePrize, type PuzzleRound } from "@/lib/puzzle-prize";
import { SOLVED, isSolved, seededMix, swapped, type Slots } from "@/lib/puzzle-round";
import { puzzleShare, share } from "@/lib/share";
import { Tiles, endsAt, mixed, useCountdown, type Drag } from "./poster-puzzle";

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

type Phase = "look" | "mix" | "play" | "won";

/** Full-screen game: see the poster, it shuffles, tap two tiles to swap them until it's whole. */
export default function PuzzleGame({
  open,
  onClose,
  src,
  name,
  aspectRatio,
  price,
  onAddToCart,
  slug,
  page = false,
  waited = false,
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
  /** Drawn full screen as a page: no sheet peeling in; history is handled by lib/puzzle-launch. */
  page?: boolean;
  /** The /puzzle/ page, which already showed the poster while loading: skip the long look. */
  waited?: boolean;
}) {
  const challenge = (solvedIn?: number) => slug && void share(puzzleShare({ slug, name, image: src }, solvedIn, pct));
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("look");
  const [slots, setSlots] = useState<Slots>(SOLVED);
  const [picked, setPicked] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [prize, setPrize] = useState<number | null | "none">(null);
  const [round, setRound] = useState(0);
  const started = useRef(0);
  // this game's server round and the swaps played on it (sent to claim the prize)
  const playRound = useRef<PuzzleRound | null>(null);
  const moveLog = useRef<[number, number][]>([]);
  const [seconds, setSeconds] = useState(0);
  // feedback: tiles that just landed right, a hint, holding Peek to see the poster whole
  const [landed, setLanded] = useState<number[]>([]);
  const [hint, setHint] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const [peek, setPeek] = useState(false);
  const prizeNow = usePuzzlePrize();
  const pct = usePuzzlePercent();
  const prizeLeft = useCountdown(prizeNow);
  // a pop-up adds a back step; the game page is a page, back just leaves it
  useBackToClose(open && !page, onClose);

  // Stays mounted while the sheet peels off, like every pop-up in the shop.
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    // a full-screen game page just goes (the page underneath is right there)
    if (page) {
      setShown(false);
      return;
    }
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
    setPhase("look");
    setSlots(SOLVED);
    setPicked(null);
    setMoves(0);
    setSeconds(0);
    setHints(0);
    setHint([]);
    // "Remember it!" for 1.6s, then shuffle. The game page already showed the
    // poster with "Remember it!" while its code loaded (PuzzleBoot), so that
    // wait counts: a slow phone shuffles straight away instead of waiting again.
    const look = waited && round === 0 ? Math.max(250, 1600 - performance.now()) : 1600;
    // The mix comes from a server round (its swaps unlock the prize). It's
    // fetched now, during "Remember it!"; a slow network gets up to 2.5s more
    // of "Mixing…", then plays a local mix that can't win the prize.
    const fetched = fetchPuzzleRound();
    moveLog.current = [];
    playRound.current = null;
    let live = true;
    const timers: number[] = [window.setTimeout(() => setPhase("mix"), look)];
    timers.push(
      window.setTimeout(async () => {
        const got = await Promise.race([fetched, new Promise<null>((r) => window.setTimeout(() => r(null), 2500))]);
        if (!live) return;
        playRound.current = got;
        setSlots(got ? seededMix(got.seed) : mixed());
        timers.push(
          window.setTimeout(() => {
            setPhase("play");
            started.current = Date.now();
          }, 600)
        );
      }, look + 400)
    );
    return () => {
      live = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    moveLog.current.push([a, b]);
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
      claimPuzzlePrize(playRound.current, moveLog.current).then((expires) => setPrize(expires ?? "none"));
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
      className={page ? "puzzle-screen fixed inset-0 z-[80] flex flex-col" : `cart-label puzzle-screen fixed inset-0 z-[80] flex flex-col ${closing ? "screen-label--off pointer-events-none" : "screen-label--on"}`}
    >
      {!page && <span aria-hidden className="cart-label-flap" />}
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
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-auto sm:w-full sm:max-w-5xl sm:flex-row sm:justify-center sm:gap-8 sm:px-8 sm:pb-6">
        {/* the board, on a frame */}
        <div className="puzzle-board-col flex min-h-0 w-full flex-1 basis-0 flex-col items-center justify-center gap-2 sm:h-full sm:items-end" style={{ "--ratio": ratio } as React.CSSProperties}>
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
        <div className="flex w-full max-w-[26rem] shrink-0 flex-col gap-2 sm:w-80 sm:gap-3 sm:rounded-3xl sm:bg-white/85 sm:p-5 sm:shadow-[0_24px_60px_-28px_rgba(16,24,40,0.35)] sm:ring-1 sm:ring-line">
          {/* wider screens: the prize up top, then how to play, beside the board */}
          <div className="hidden sm:block">
            <p className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Solve &amp; win</p>
            <p className="mt-1 font-display text-3xl leading-none font-bold text-snow">
              <span className="puzzle-ticket-hl">{pct}% OFF</span>
            </p>
            <p className="mt-2 text-sm leading-snug text-fog">
              {phase === "won" ? "Solved! Your prize is ready." : picked === null ? "Swipe a tile onto another, or click two tiles to swap them." : "Now click (or swipe) the tile to swap with."}
            </p>
          </div>
          <span aria-hidden className="hidden h-px bg-line sm:block" />
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
          {/* the prize waiting at the end (wide screens say it up top, so only once won) */}
          <div className={`puzzle-ticket puzzle-live relative flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-white ${prizeNow ? "puzzle-ticket--won" : "sm:hidden"}`}>
            <Gift className="size-5 shrink-0" />
            <p className="min-w-0 flex-1 text-[13px] leading-tight font-bold">
              {prizeNow ? (
                <>Your <span className="puzzle-ticket-hl">{pct}% OFF</span> is active · ends in {prizeLeft}</>
              ) : (
                <>Solve it to unlock <span className="puzzle-ticket-hl">{pct}% OFF</span> puzzle posters</>
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
                <p className="mt-4 text-sm text-fog">The {pct}% offer has ended, but the poster still looks great.</p>
              ) : (
                // the prize as a coupon: notched, stamped
                <div className="puzzle-win-up puzzle-ticket puzzle-ticket--won puzzle-win-coupon relative mt-4 overflow-hidden rounded-2xl px-4 py-3 text-left text-white" style={{ animationDelay: "1.1s" }}>
                  <span aria-hidden className="puzzle-stamp absolute top-2.5 right-3" style={{ animationDelay: "1.5s" }}>
                    Unlocked
                  </span>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">Your prize</p>
                  <p className="font-display text-[26px] leading-none font-bold">
                    <span className="puzzle-ticket-hl">{pct}% OFF</span>
                  </p>
                  {price !== undefined && (
                    <p className="mt-1.5 text-sm">
                      This puzzle poster <span className="line-through opacity-70">{formatINR(price)}</span>{" "}
                      <b className="font-display text-lg">{formatINR(price - couponDiscount(price, pct))}</b>
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-white/80">On puzzle posters · at checkout · until {endsAt(prize)}</p>
                </div>
              )}
              {onAddToCart && prize !== "none" ? (
                <button
                  type="button"
                  onClick={() => {
                    onAddToCart();
                    // the game page stays: the cart opens over it (closing the cart comes back here)
                    if (!page) onClose();
                  }}
                  className="peel-btn mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold"
                >
                  <ShoppingBag className="peel-icon size-5" /> Add to cart
                  {typeof prize === "number" && price !== undefined ? ` · ${formatINR(price - couponDiscount(price, pct))}` : ""}
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
