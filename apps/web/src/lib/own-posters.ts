// A shopper's own wall posters. The picture stays in this browser while they arrange
// the wall (it's in memory for this page, and in IndexedDB for the next), and leaves
// it only when they press Pay.
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { OWN_POSTER_PREFIX, isOwnPoster, type CartCustomSpec } from "@stickypie/shared";
import type { CartItem } from "@/components/cart-context";
import { idbDelete, idbGet, idbSet } from "./idb";
import { posterImage, rememberPoster } from "./poster-images";

/** How a picture sits in the 2:3 frame: zoom, and the point of it at the frame's centre (0–1). */
export type PosterFit = { zoom: number; x: number; y: number };
/** `art`: the 2:3 file to print. `source`: what the shopper picked, to fit it again. `url`: once sent. */
export type OwnPoster = { art: Blob; source: Blob; fit: PosterFit; url?: string };

const LIST_KEY = "own-posters";
const storeKey = (id: string) => `own-poster:${id}`;

const posters = new Map<string, OwnPoster>();
const loading = new Set<string>();
const gone = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function show(id: string, poster: OwnPoster) {
  posters.set(id, poster);
  rememberPoster(id, URL.createObjectURL(poster.art));
}

async function load(id: string) {
  if (posters.has(id) || loading.has(id) || gone.has(id)) return;
  loading.add(id);
  const poster = await idbGet<OwnPoster>(storeKey(id));
  loading.delete(id);
  if (poster) show(id, poster);
  else gone.add(id);
  changed();
}

/** Clears pictures no wall or cart uses any more. Those added on this page stay: an arrangement may still come back to them. */
async function sweep() {
  let used = "";
  try {
    used = `${localStorage.getItem("stickypie.cart.v1")} ${sessionStorage.getItem("stickypie.wall.picks")}`;
  } catch {
    return;
  }
  const list = (await idbGet<string[]>(LIST_KEY)) ?? [];
  const keep = list.filter((id) => posters.has(id) || used.includes(id));
  await Promise.all(list.filter((id) => !keep.includes(id)).map((id) => idbDelete(storeKey(id))));
  if (keep.length !== list.length) await idbSet(LIST_KEY, keep);
}

/** Keeps a new picture and returns its id for the wall. */
export async function addOwnPoster(poster: OwnPoster): Promise<string> {
  const id = `${OWN_POSTER_PREFIX}${crypto.randomUUID()}`;
  show(id, poster);
  await idbSet(storeKey(id), poster);
  await idbSet(LIST_KEY, [...((await idbGet<string[]>(LIST_KEY)) ?? []), id]);
  void sweep();
  changed();
  return id;
}

export async function ownPoster(id: string): Promise<OwnPoster | null> {
  return posters.get(id) ?? (await idbGet<OwnPoster>(storeKey(id)));
}

/** True when this browser no longer has the picture (another device, cleared storage). */
export const ownPosterGone = (id: string) => gone.has(id);

/** Fetches these pictures from storage and redraws once they're in. Returns a number that changes when they do. */
export function useOwnPosters(ids: string[] | null | undefined) {
  const seen = useSyncExternalStore(subscribe, () => version, () => 0);
  const own = ids?.filter(isOwnPoster).join();
  useEffect(() => {
    if (own) own.split(",").forEach((id) => void load(id));
  }, [own]);
  return seen;
}

/** The own posters of a cart's walls. */
function ownIds(items: CartItem[]) {
  return [...new Set(items.flatMap((item) => (item.customSpec?.kind === "wall" ? item.customSpec.posters.filter(isOwnPoster) : [])))];
}

export const hasOwnPosters = (items: CartItem[]) => ownIds(items).length > 0;

/** One poster on its way, for the list shown while they go up. */
export type PosterSend = { id: string; wall: string; thumb: string | null; percent: number; failed?: string };

/** Uploads one file with real progress (fetch can't report upload progress). */
function send(poster: OwnPoster, token: string | null, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", new File([poster.art], "poster.jpg", { type: poster.art.type }));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/checkout/own-poster");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // All sent isn't stored yet: 100 waits for the answer.
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data.error ?? "Couldn't send your poster. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Couldn't send your poster. Check your connection and try again."));
    xhr.send(form);
  });
}

/** Sends the cart's own posters, one by one. A poster already sent (a retry) isn't sent again. */
export async function sendOwnPosters(items: CartItem[], token: string | null, onChange: (rows: PosterSend[]) => void) {
  const wallOf = (id: string) => items.find((item) => item.customSpec?.kind === "wall" && item.customSpec.posters.includes(id));
  const ids = ownIds(items);
  await Promise.all(ids.map(load));
  const parts = await Promise.all(ids.map(ownPoster));
  let rows: PosterSend[] = ids.map((id, i) => ({
    id,
    wall: wallOf(id)?.name.replace(/\s*(—|·).*$/, "") ?? "Your wall",
    thumb: posterImage(id),
    percent: parts[i]?.url ? 100 : 0,
  }));
  const update = (at: number, change: Partial<PosterSend>) => {
    rows = rows.map((row, i) => (i === at ? { ...row, ...change } : row));
    onChange(rows);
  };
  onChange(rows);

  const urls: Record<string, string> = {};
  for (const [at, id] of ids.entries()) {
    const poster = parts[at];
    try {
      if (!poster) throw new Error("This poster isn't on this device any more. Add it to your wall again.");
      if (!poster.url) {
        poster.url = await send(poster, token, (percent) => update(at, { percent }));
        await idbSet(storeKey(id), poster);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send your poster. Please try again.";
      update(at, { failed: message });
      throw new Error(message);
    }
    update(at, { percent: 100 });
    urls[id] = poster.url;
  }
  return urls;
}

/** A wall's cart details with the stored picture of each of its own posters. */
export function withOwnPosters(spec: CartCustomSpec, urls: Record<string, string>): CartCustomSpec {
  if (spec.kind !== "wall") return spec;
  const own = Object.fromEntries(spec.posters.filter(isOwnPoster).map((id) => [id, urls[id]]));
  return Object.keys(own).length ? { ...spec, own } : spec;
}
