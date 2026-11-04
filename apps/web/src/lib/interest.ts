"use client";

// What this shopper has been looking at, kept in their own browser only (never
// sent anywhere): how often they opened a sticker of each category. The home
// hero leans towards those categories so it shows more of what they like.

const KEY = "stickypie.interest";
const MAX_CATEGORIES = 12;
/** Stickers already counted on this visit (a page can mount more than once). */
const counted = new Set<string>();

export type Interest = Record<string, number>; // category id → views

export function readInterest(): Interest {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** A sticker page was opened: count its categories once per visit (the busiest dozen are kept). */
export function rememberInterest(slug: string, categoryIds: (string | null | undefined)[]) {
  if (counted.has(slug)) return;
  counted.add(slug);
  try {
    const now = readInterest();
    for (const id of categoryIds) if (id) now[id] = (now[id] ?? 0) + 1;
    const kept = Object.entries(now)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // private mode / storage off: the hero just doesn't personalise
  }
}
