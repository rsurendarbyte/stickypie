import { Puzzle } from "lucide-react";

/**
 * A still copy of the puzzle game's first screen, in the page's HTML, so the
 * game draws at once, even before the page's code has loaded. It sits under
 * the game, which covers it once open.
 */
export default function PuzzleBoot({ src, name, ratio }: { src: string; name: string; ratio: number }) {
  return (
    <div aria-hidden className="puzzle-screen fixed inset-0 z-[79] flex flex-col">
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
            {/* the game's own first step, so the wait while it loads is part of the game */}
            <span className="absolute inset-0 grid place-items-center">
              <span className="rounded-2xl bg-snow/80 px-4 py-2 text-center text-white">
                <span className="block font-display text-lg font-bold">Remember it!</span>
                <span className="block text-[11px] text-white/80">It&apos;s about to shuffle</span>
              </span>
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-fog">Swap the tiles back · win a prize</p>
      </div>
    </div>
  );
}
