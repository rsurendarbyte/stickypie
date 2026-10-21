/** Placeholder with the product card's exact footprint, shown while the live list loads. */
export default function ProductCardSkeleton({
  width = "w-44 shrink-0 sm:w-48 md:w-52",
}: {
  width?: string;
}) {
  return (
    <div
      aria-hidden
      className={`snap-start overflow-hidden rounded-2xl border border-line bg-ink ${width}`}
    >
      <div className="aspect-square animate-pulse bg-panel/70" />
      <div className="min-h-[46px] space-y-1.5 px-3 pt-2.5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-panel" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-panel/70" />
      </div>
      <div className="p-3 pt-1.5">
        <div className="h-10 w-full animate-pulse rounded-full bg-panel sm:h-11 sm:rounded-xl" />
      </div>
    </div>
  );
}
