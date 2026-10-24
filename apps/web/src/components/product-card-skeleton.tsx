import StickerLoader from "./sticker-loader";

/**
 * Placeholder with the product card's exact footprint, shown while the live
 * list loads: a blank sticker peeling its corner, shimmering text lines.
 */
export default function ProductCardSkeleton({
  width = "w-44 shrink-0 sm:w-48 md:w-52",
  index = 0,
  poster = false,
}: {
  width?: string;
  /** Mini poster card: taller art stage. */
  poster?: boolean;
  /** Position in the row — staggers the peel so cards don't move in sync. */
  index?: number;
}) {
  return (
    <div
      aria-hidden
      className={`snap-start overflow-hidden rounded-2xl border border-line bg-ink ${width}`}
    >
      <div className={`grid place-items-center bg-ink2 ${poster ? "aspect-[3/4]" : "aspect-square"}`}>
        <StickerLoader size="52%" variant="blank" delay={(index % 6) * 0.15} />
      </div>
      <div className="min-h-[46px] space-y-1.5 px-3 pt-2.5">
        <div className="shimmer h-3 w-3/4 rounded" />
        <div className="shimmer h-2.5 w-1/2 rounded" />
      </div>
      <div className="p-3 pt-1.5">
        <div className="shimmer h-10 w-full rounded-full sm:h-11 sm:rounded-xl" />
      </div>
    </div>
  );
}
