"use client";

import { useEffect, useRef, useState } from "react";
import { drawPrint, randomTyre, type Tyre } from "@/lib/mt-tyres";

/**
 * Car-culture cursor for mouse users: the pointer is a little Jeep-style
 * mud-terrain wheel that rolls (spins with the distance travelled), leaves fading chunky
 * off-road tread prints in mud behind it, flings mud off the back as it
 * rolls, and does a burnout — smoke, flung
 * mud and a dark patch — when it pulls away from a stop and when it brakes hard.
 * Over links and buttons it keeps its size and gets a white sticker edge. Text fields keep the normal text cursor.
 *
 * Off on touch screens, for "reduce motion", and on weak devices (lite mode).
 */

const WHEEL = 34; // px
const MARK_LIFE = 1500; // ms a tread print takes to fade
const STEP = 7; // px between tread prints along the path
const MUD = "92, 64, 38"; // rgb
const IDLE_MS = 260; // still for this long = stopped
const BRAKE_SPEED = 1.1; // px/ms — faster than this, then stopping = a skid

/** One tread print: a row of mud-terrain lugs across the track. */

type Print = { x: number; y: number; a: number; t: number; alt: boolean };
/** A dark rubber/mud patch left by a burnout. */
type Patch = { x: number; y: number; r: number; t: number };
type Puff = { x: number; y: number; vx: number; vy: number; r: number; t: number; life: number; mud: boolean };

export default function CarCursor() {
  const [on, setOn] = useState(false);
  // A different mud-terrain tyre on every page load (5 designs).
  const [tyre, setTyre] = useState<Tyre | null>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Only for a real mouse, with motion allowed, and not in lite mode.
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Lite "net" only skips big images; weak CPU / low frame rate skips this too.
    const lite = document.documentElement.dataset.lite;
    const check = () => setOn(fine.matches && !calm.matches && (!lite || lite === "net"));
    setTyre(randomTyre());
    check();
    fine.addEventListener("change", check);
    calm.addEventListener("change", check);
    return () => {
      fine.removeEventListener("change", check);
      calm.removeEventListener("change", check);
    };
  }, []);

  useEffect(() => {
    if (!on || !tyre) return;
    const style = tyre.print;
    const el = wheel.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    document.documentElement.classList.add("car-cursor");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const prints: Print[] = [];
    const patches: Patch[] = [];
    const puffs: Puff[] = [];
    let rolled = 0, // px since the last tread print
      alt = false;
    let x = -100,
      y = -100,
      lastX = -100,
      lastY = -100,
      lastMove = 0,
      speed = 0,
      angle = 0,
      moving = false,
      hidden = true,
      hot = false,
      frame = 0;

    const burnout = (px: number, py: number, strength: number) => {
      const now = performance.now();
      patches.push({ x: px, y: py, r: 9 * strength, t: now });
      // smoke
      for (let i = 0; i < 8 * strength; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.02 + Math.random() * 0.05;
        puffs.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.03, r: 4 + Math.random() * 5, t: now, life: 650 + Math.random() * 500, mud: false });
      }
      // flung mud
      for (let i = 0; i < 10 * strength; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.12 + Math.random() * 0.18;
        puffs.push({ x: px, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.08, r: 1.2 + Math.random() * 2.2, t: now, life: 450 + Math.random() * 350, mud: true });
      }
      el.classList.remove("car-cursor-rev");
      void el.offsetWidth; // restart the spin-up animation
      el.classList.add("car-cursor-rev");
    };

    const draw = () => {
      frame = 0;
      const now = performance.now();

      // Stopped? Hard braking leaves a skid.
      if (moving && now - lastMove > IDLE_MS) {
        moving = false;
        if (speed > BRAKE_SPEED) burnout(x, y, 1);
        speed = 0;
      }

      // Wheel follows the pointer and turns with distance rolled.
      el.style.transform = `translate3d(${x - WHEEL / 2}px, ${y - WHEEL / 2}px, 0) rotate(${angle}rad)`;
      el.style.opacity = hidden ? "0" : "1";

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // burnout patches
      for (let i = patches.length - 1; i >= 0; i--) {
        const p = patches[i];
        const age = (now - p.t) / (MARK_LIFE * 1.4);
        if (age >= 1) {
          patches.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(${MUD}, ${0.3 * (1 - age)})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 1.4, p.r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // mud-terrain tread prints: two staggered rows of chunky lugs
      for (let i = prints.length - 1; i >= 0; i--) {
        const m = prints[i];
        const age = (now - m.t) / MARK_LIFE;
        if (age >= 1) {
          prints.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.a);
        ctx.fillStyle = `rgba(${MUD}, ${0.42 * (1 - age)})`;
        // this tyre's own tread pattern (x = along the path, y = across it)
        drawPrint(ctx, style, m.alt);
        ctx.restore();
      }
      // smoke
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        const age = (now - p.t) / p.life;
        if (age >= 1) {
          puffs.splice(i, 1);
          continue;
        }
        const dt = 16;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.mud) p.r += 0.35;
        if (p.mud) p.vy += 0.012; // mud falls back down
        ctx.fillStyle = p.mud ? `rgba(${MUD}, ${0.6 * (1 - age)})` : `rgba(150, 155, 165, ${0.32 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Keep animating only while something is still fading or moving.
      if (prints.length || patches.length || puffs.length || moving) frame = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      x = e.clientX;
      y = e.clientY;
      if (hidden) {
        hidden = false;
        lastX = x;
        lastY = y;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.hypot(dx, dy);
      const dt = Math.max(1, now - lastMove);
      // Pulling away from a stop: wheelspin.
      if (!moving && dist > 2 && now - lastMove > IDLE_MS) burnout(lastX, lastY, 0.7);
      if (dist > 0.5) {
        speed = speed * 0.7 + (dist / dt) * 0.3;
        angle += (dist / (WHEEL / 2)) * Math.sign(dx || dy || 1);
        // Stamp a tread print every STEP px along the path.
        const dir = Math.atan2(dy, dx);
        rolled += dist;
        let k = STEP - (rolled - dist);
        while (rolled >= STEP) {
          const f = Math.min(1, Math.max(0, k / dist));
          alt = !alt;
          prints.push({ x: lastX + dx * f, y: lastY + dy * f, a: dir, t: now, alt });
          rolled -= STEP;
          k += STEP;
        }
        if (prints.length > 600) prints.splice(0, prints.length - 600);
        // Mud flung off the back of the spinning tyre — more the faster it rolls.
        const flecks = Math.min(4, Math.floor(speed * 2.2 + Math.random()));
        for (let i = 0; i < flecks && puffs.length < 260; i++) {
          const back = dir + Math.PI + (Math.random() - 0.5) * 1.3;
          const s = 0.08 + Math.random() * 0.14 + speed * 0.05;
          puffs.push({
            x: x - Math.cos(dir) * WHEEL * 0.4,
            y: y - Math.sin(dir) * WHEEL * 0.4,
            vx: Math.cos(back) * s,
            vy: Math.sin(back) * s - 0.1,
            r: 0.9 + Math.random() * 1.9,
            t: now,
            life: 380 + Math.random() * 320,
            mud: true,
          });
        }
        moving = true;
        lastMove = now;
      }
      lastX = x;
      lastY = y;
      // Over something clickable: bigger wheel, lit hub.
      const target = e.target instanceof Element ? e.target : null;
      const nextHot = Boolean(target?.closest("a, button, [role=button], label, select, summary"));
      if (nextHot !== hot) {
        hot = nextHot;
        el.classList.toggle("car-cursor-hot", hot);
      }
      // Text fields keep the normal I-beam; the wheel steps aside.
      el.classList.toggle("car-cursor-away", Boolean(target?.closest("input, textarea, [contenteditable]")));
      kick();
    };
    const onLeave = () => {
      hidden = true;
      kick();
    };
    const onDown = () => el.classList.add("car-cursor-press");
    const onUp = () => el.classList.remove("car-cursor-press");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", resize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.documentElement.classList.remove("car-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
    };
  }, [on, tyre]);

  if (!on || !tyre) return null;
  return (
    <>
      <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[95] h-full w-full" />
      <div ref={wheel} aria-hidden className="car-cursor-wheel pointer-events-none fixed top-0 left-0 z-[96]" style={{ width: WHEEL, height: WHEEL, opacity: 0 }}>
        {/* one of the Jeep-style mud-terrain tyres (lib/mt-tyres.ts) */}
        <svg viewBox="0 0 64 64" width={WHEEL} height={WHEEL} dangerouslySetInnerHTML={{ __html: tyre.svg }} />
      </div>
    </>
  );
}
