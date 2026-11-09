import { Puzzle } from "lucide-react";

/**
 * A still copy of the puzzle game's first screen, in the page's HTML: shown only
 * while html[data-puzzle-boot] is set (lib/puzzle-boot.ts), so a game link
 * draws the game at once, even before the page's code has loaded.
 */
export default function PuzzleBoot({ src, name, ratio }: { src: string; name: string; ratio: number }) {
  return (
    <div aria-hidden className="puzzle-boot puzzle-screen fixed inset-0 z-[79] flex-col">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
        <span className="puzzle-cta grid size-10 shrink-0 place-items-center rounded-xl text-white">
          <Puzzle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.18em] text-brand uppercase">Puzzle challenge</p>
          <p className="truncate font-display text-base leading-tight font-bold">{name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "")}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 pb-8">
        <div className="puzzle-frame w-full max-w-[22rem] rounded-2xl p-2.5" style={{ maxWidth: `min(22rem, calc((100dvh - 14rem) * ${ratio}))` }}>
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
            <img src={src} alt="" fetchPriority="high" className="absolute inset-0 size-full rounded-[3px] object-cover" />
          </div>
        </div>
        <p className="text-sm font-semibold text-fog">Getting your puzzle ready…</p>
      </div>
    </div>
  );
}
