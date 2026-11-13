// The AI style card pictures are 512px WebPs (the style pages show them about
// 200px wide). Where they are drawn small (the hero's poster wall), a 240px copy
// sits next to each one: same address with ".s240.webp" at the end, made by
// scripts/avatar-small-covers.mjs and by the admin when a card picture is uploaded.

/** The 240px copy of a style card picture; null when it has none (old PNGs, sample sheets). */
export function smallCover(url: string): string | null {
  // uploaded cards, and the built-in sample cards that ship with the shop (public/avatar-samples)
  const ok = /^https?:\/\/.+(?<!\.s240)\.webp$/.test(url) || /^\/avatar-samples\/[\w-]+-cover(-boy)?\.webp$/.test(url);
  return ok ? url.replace(/\.webp$/, ".s240.webp") : null;
}
