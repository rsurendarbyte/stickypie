"use client";

import { useEffect, useRef, useState } from "react";
import { SHOP_THEME } from "@stickypie/shared";

/**
 * A little motion behind the mouse pointer (the pointer itself is the CSS
 * sticker arrow, lib/sticker-cursor.ts, so it's never hard to find). A
 * different one on every page load, picked at random:
 *   confetti — tiny die-cut stars and dots drop off the arrow's tail and fade
 *   ribbon   — a short theme-coloured sticker ribbon follows the arrow
 *   sparkle  — yellow sparkles twinkle around the arrow now and then
 * Every style pops a small burst of stickers on click — and on a tap on
 * phones, which get the pop only (a moving finger is scrolling). Draws only
 * while something is on screen — a still mouse costs nothing.
 *
 * Off for "reduce motion" and on weak devices (lite mode).
 * On localhost, ?trail=<style> holds one style while you look at it
 * (remembered in the browser; ?trail=random goes back to random).
 */

export type TrailStyle = "confetti" | "ribbon" | "sparkle";
const STYLES: TrailStyle[] = ["confetti", "ribbon", "sparkle"];

const INK = "#1c1a24";
const YELLOW = "#ffc93c";
const COLOURS = [SHOP_THEME.brand, SHOP_THEME.brand2, YELLOW, INK];
const BURST = 9; // pieces in a click pop

type Piece = {
  kind: "star" | "dot" | "sparkle";
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
  a: number;
  size: number;
  colour: string;
  t: number;
  life: number;
};

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function starPath(ctx: CanvasRenderingContext2D, size: number, points: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? size * inner : size;
    const ang = (i * Math.PI) / points - Math.PI / 2;
    ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  ctx.closePath();
}

/** One piece with a white sticker edge; `age` 0…1. */
function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, age: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  let alpha = age < 0.12 ? age / 0.12 : 1 - (age - 0.12) / 0.88;
  let scale = 1;
  if (p.kind === "sparkle") {
    scale = Math.sin(age * Math.PI); // grows, then shrinks away
    alpha = 1;
  }
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.scale(scale, scale);
  if (p.kind === "star") starPath(ctx, p.size, 5, 0.45);
  else if (p.kind === "sparkle") starPath(ctx, p.size, 4, 0.28);
  else {
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = p.kind === "sparkle" ? 1.6 : 2.4;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.fillStyle = p.colour;
  ctx.fill();
  ctx.restore();
}

/** This page's style: random, or one held with ?trail= on localhost. */
function chosenStyle(): TrailStyle {
  const random = pick(STYLES);
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return random;
  try {
    const asked = new URLSearchParams(location.search).get("trail");
    if (asked === "random") localStorage.removeItem("stickypie.trail");
    else if (asked && STYLES.includes(asked as TrailStyle)) localStorage.setItem("stickypie.trail", asked);
    const held = localStorage.getItem("stickypie.trail") as TrailStyle | null;
    return held && STYLES.includes(held) ? held : random;
  } catch {
    return random;
  }
}

export default function CursorTrail() {
  const [style, setStyle] = useState<TrailStyle | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // With motion allowed and not in lite mode (touch screens get the tap pop only).
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Lite "net" only skips big images; weak CPU / low frame rate skips this too.
    const lite = document.documentElement.dataset.lite;
    const check = () =>
      setStyle(!calm.matches && (!lite || lite === "net") ? chosenStyle() : null);
    check();
    calm.addEventListener("change", check);
    return () => {
      calm.removeEventListener("change", check);
    };
  }, []);

  useEffect(() => {
    if (!style) return;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const pieces: Piece[] = [];
    const path: { x: number; y: number; t: number }[] = []; // ribbon
    const RIBBON_MS = 260;
    let frame = 0;
    let travelled = 0;
    let lastX = -1;
    let lastY = -1;
    let last = performance.now();

    const wake = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const add = (p: Omit<Piece, "t">) => {
      pieces.push({ ...p, t: performance.now() });
      if (pieces.length > 90) pieces.shift();
      wake();
    };

    const drawRibbon = (now: number) => {
      while (path.length && now - path[0].t > RIBBON_MS) path.shift();
      if (path.length < 2) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // white sticker edge under a theme-coloured ribbon, thickening to the head
      for (const [colour, extra] of [["#fff", 3], [SHOP_THEME.brand, 0]] as const) {
        for (let i = 1; i < path.length; i++) {
          const k = i / (path.length - 1);
          ctx.globalAlpha = colour === "#fff" ? k * 0.9 : k;
          ctx.strokeStyle = colour === "#fff" ? "#fff" : k > 0.5 ? SHOP_THEME.brand : SHOP_THEME.brand2;
          ctx.lineWidth = 1 + k * 5 + extra;
          ctx.beginPath();
          ctx.moveTo(path[i - 1].x, path[i - 1].y);
          ctx.lineTo(path[i].x, path[i].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (style === "ribbon") drawRibbon(now);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        const age = (now - p.t) / p.life;
        if (age >= 1) {
          pieces.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.spin * dt;
        drawPiece(ctx, p, age);
      }
      frame = pieces.length || path.length > 1 ? requestAnimationFrame(tick) : 0;
      if (!frame) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    // where the arrow's tail is, relative to its tip
    const TAIL_X = 10;
    const TAIL_Y = 14;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const x = e.clientX;
      const y = e.clientY;
      if (lastX < 0) {
        lastX = x;
        lastY = y;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const len = Math.hypot(dx, dy) || 1;
      lastX = x;
      lastY = y;
      travelled += len;

      if (style === "ribbon") {
        path.push({ x: x + 2, y: y + 3, t: performance.now() });
        wake();
        return;
      }
      if (style === "confetti" && travelled >= 22) {
        travelled = 0;
        add({
          kind: Math.random() < 0.6 ? "star" : "dot",
          x: x + TAIL_X,
          y: y + TAIL_Y,
          vx: (-dx / len) * 0.04 + (Math.random() - 0.5) * 0.05,
          vy: (-dy / len) * 0.04 - 0.02,
          gravity: 0.0009,
          spin: (Math.random() - 0.5) * 0.01,
          a: Math.random() * Math.PI,
          size: 4.5 + Math.random() * 2,
          colour: pick(COLOURS),
          life: 1100 * (0.75 + Math.random() * 0.5),
        });
      } else if (style === "sparkle" && travelled >= 40) {
        travelled = 0;
        add({
          kind: "sparkle",
          x: x + 8 + (Math.random() - 0.3) * 26,
          y: y + 8 + (Math.random() - 0.3) * 26,
          vx: 0,
          vy: -0.01,
          gravity: 0,
          spin: 0.002,
          a: 0,
          size: 5 + Math.random() * 3,
          colour: Math.random() < 0.75 ? YELLOW : SHOP_THEME.brand2,
          life: 700 + Math.random() * 300,
        });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !e.isPrimary) return; // one pop per tap, not per finger
      for (let i = 0; i < BURST; i++) {
        const ang = (i / BURST) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 0.12 + Math.random() * 0.1;
        add({
          kind: style === "sparkle" ? "sparkle" : Math.random() < 0.6 ? "star" : "dot",
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 0.05,
          gravity: 0.0009,
          spin: (Math.random() - 0.5) * 0.01,
          a: Math.random() * Math.PI,
          size: 6 + Math.random() * 3,
          colour: pick(COLOURS),
          life: 900 * (0.75 + Math.random() * 0.5),
        });
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", resize);
    };
  }, [style]);

  if (!style) return null;
  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[95] h-full w-full" />;
}
