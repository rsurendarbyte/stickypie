// Drag one poster of a wall onto another to swap them. A mouse picks a poster up
// as soon as it moves. A finger picks it up by sliding sideways, or by holding it
// for a moment and then going any way, so an up or down swipe over the wall still
// scrolls the page. The lifted poster moves on the compositor, with no React render,
// so it stays with the finger on slow phones.
"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const HOLD_MS = 150;
const MOUSE_SLOP = 5;
const FINGER_SLOP = 9;
const LIFT = 1.07;
const EASE = "cubic-bezier(0.2, 0.85, 0.25, 1)";

type Box = { node: HTMLElement; spot: number; rect: DOMRect };
type Landing = { from: Box; to: Box; dx: number; dy: number };

const spotOf = (node: Element) => Number((node as HTMLElement).dataset.wallSpot);
const centre = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `order` is the wall's posters as a string: when it changes after a drop, they glide to their new spots. */
export function useWallDrag(root: RefObject<HTMLElement | null>, onSwap: ((from: number, to: number) => void) | undefined, order: string) {
  const swap = useRef(onSwap);
  const landing = useRef<Landing | null>(null);
  const on = Boolean(onSwap);

  useEffect(() => {
    swap.current = onSwap;
  });

  useEffect(() => {
    const el = root.current;
    if (!el || !on) return;
    let lifted = false;
    let cancelPress: (() => void) | null = null;

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || cancelPress || lifted) return;
      const target = e.target as Element;
      const held = target.closest<HTMLElement>("[data-wall-drag]");
      if (!held || target.closest("[data-wall-control]")) return;
      const finger = e.pointerType === "touch";
      const [startX, startY] = [e.clientX, e.clientY];
      let [x, y] = [startX, startY];
      let boxes: Box[] = [];
      let over: Box | null = null;
      let hold = 0;

      const place = () => {
        held.style.transform = `translate3d(${x - startX}px, ${y - startY}px, 0) scale(${LIFT})`;
        const under = boxes.find((b) => b.node !== held && x >= b.rect.left && x <= b.rect.right && y >= b.rect.top && y <= b.rect.bottom) ?? null;
        if (under === over) return;
        over?.node.classList.remove("is-drop");
        under?.node.classList.add("is-drop");
        over = under;
      };

      const lift = () => {
        lifted = true;
        boxes = [...el.querySelectorAll<HTMLElement>("[data-wall-spot]")].map((node) => ({ node, spot: spotOf(node), rect: node.getBoundingClientRect() }));
        held.classList.add("is-lifted");
        held.style.zIndex = "40";
        held.style.willChange = "transform";
        held.style.transition = "transform 0.13s ease-out";
        held.style.transform = `translate3d(${x - startX}px, ${y - startY}px, 0) scale(${LIFT})`;
        if (finger) navigator.vibrate?.(8);
        window.setTimeout(() => {
          if (lifted) held.style.transition = "none";
        }, 130);
      };

      const stopListening = () => {
        window.clearTimeout(hold);
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        window.removeEventListener("pointercancel", cancel, true);
        cancelPress = null;
      };

      const settle = () => {
        over?.node.classList.remove("is-drop");
        held.classList.remove("is-lifted");
        held.style.transition = "";
        held.style.transform = "";
        held.style.willChange = "";
        held.style.zIndex = "";
        lifted = false;
      };

      const flyBack = () => {
        const from = `translate(${x - startX}px, ${y - startY}px) scale(${LIFT})`;
        settle();
        if (calm()) return;
        held.style.zIndex = "40";
        held.animate([{ transform: from }, { transform: "none" }], { duration: 200, easing: EASE }).finished.finally(() => {
          held.style.zIndex = "";
        });
      };

      function move(ev: PointerEvent) {
        if (ev.pointerId !== e.pointerId) return;
        [x, y] = [ev.clientX, ev.clientY];
        if (!lifted) {
          const [across, down] = [Math.abs(x - startX), Math.abs(y - startY)];
          if (Math.hypot(across, down) <= (finger ? FINGER_SLOP : MOUSE_SLOP)) return;
          // Before the hold is up, a finger going up or down is scrolling.
          if (finger && down >= across) return stopListening();
          window.clearTimeout(hold);
          lift();
        }
        place();
      }

      function up(ev: PointerEvent) {
        if (ev.pointerId !== e.pointerId) return;
        const wasLifted = lifted;
        stopListening();
        if (!wasLifted) return;
        // The wall's page and the swipe view both act on a tap of the art: this wasn't one.
        ev.stopPropagation();
        const quiet = (click: Event) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener("click", quiet, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", quiet, true), 80);

        place();
        const to = over;
        const from = boxes.find((b) => b.node === held);
        if (!to || !from) return flyBack();
        landing.current = { from, to, dx: x - startX, dy: y - startY };
        settle();
        swap.current?.(from.spot, to.spot);
      }

      function cancel(ev: PointerEvent) {
        if (ev.pointerId !== e.pointerId) return;
        const wasLifted = lifted;
        stopListening();
        if (wasLifted) flyBack();
      }

      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", up, true);
      window.addEventListener("pointercancel", cancel, true);
      cancelPress = stopListening;
      if (finger) hold = window.setTimeout(lift, HOLD_MS);
    };

    // Must not be passive: once a poster is up, this is what stops the page scrolling under it.
    const touchMove = (e: TouchEvent) => {
      if (lifted && e.cancelable) e.preventDefault();
    };
    // A long press would open the phone's image menu.
    const menu = (e: Event) => {
      if ((e.target as Element).closest("[data-wall-drag]")) e.preventDefault();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("touchmove", touchMove, { passive: false });
    el.addEventListener("contextmenu", menu);
    return () => {
      cancelPress?.();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("touchmove", touchMove);
      el.removeEventListener("contextmenu", menu);
    };
  }, [root, on]);

  // Before paint: the two posters have swapped in the DOM, so start each from where the eye left it.
  useLayoutEffect(() => {
    const done = landing.current;
    landing.current = null;
    if (!done || calm()) return;
    const { from, to, dx, dy } = done;
    const [fromX, fromY] = centre(from.rect);
    const [toX, toY] = centre(to.rect);
    const glide = (node: HTMLElement, start: string, top: boolean) => {
      const print = node.querySelector<HTMLElement>(".wall-print");
      if (!print) return;
      node.style.zIndex = top ? "40" : "30";
      print.animate([{ transform: start }, { transform: "none" }], { duration: 240, easing: EASE }).finished.finally(() => {
        node.style.zIndex = "";
      });
    };
    glide(to.node, `translate(${fromX + dx - toX}px, ${fromY + dy - toY}px) scale(${(from.rect.width * LIFT) / to.rect.width})`, true);
    glide(from.node, `translate(${toX - fromX}px, ${toY - fromY}px) scale(${to.rect.width / from.rect.width})`, false);
  }, [order]);
}
