/**
 * Sticker-peel loader: the StickyPie sticker peels its corner up and back.
 * `variant="blank"` is the grey placeholder used in skeletons; `onBrand` is
 * the small white one for loading states inside pink buttons.
 */
export default function StickerLoader({
  size = 56,
  variant = "logo",
  delay = 0,
  label,
  className = "",
}: {
  size?: number | string;
  variant?: "logo" | "blank" | "onBrand";
  /** Seconds — staggers several loaders in a row. */
  delay?: number;
  /** Text under the loader (also read by screen readers). */
  label?: string;
  className?: string;
}) {
  const sticker = (
    <span
      className={`peel ${variant === "blank" ? "peel-blank" : variant === "onBrand" ? "peel-on-brand" : ""}`}
      style={{ width: size, height: size, ["--peel-delay" as string]: `${delay}s` }}
      aria-hidden
    >
      <span className="peel-face" style={variant === "logo" ? { padding: "8%" } : undefined}>
        {variant === "logo" && (
          <img src="/icons/icon-192.png" alt="" className="size-full rounded-[18%] object-cover" />
        )}
      </span>
      <span className="peel-flap-wrap">
        <span className="peel-flap block" />
      </span>
    </span>
  );

  if (!label) {
    return (
      <span role="status" aria-label="Loading" className={`inline-flex ${className}`}>
        {sticker}
      </span>
    );
  }
  return (
    <span role="status" className={`inline-flex flex-col items-center gap-3 ${className}`}>
      {sticker}
      <span className="text-sm font-medium text-fog">{label}</span>
    </span>
  );
}

/**
 * Whole-page loading state: pinned to the visible area below the 72px header,
 * so the sticker is centred on screen whatever the scroll position.
 */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-x-0 top-[72px] bottom-0 z-30 grid place-items-center bg-ink">
      <StickerLoader size={64} label={label} />
    </div>
  );
}
