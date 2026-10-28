/**
 * Stands in for a price that comes from the admin's settings until they've
 * loaded, so the built-in default (or an outdated saved price) never shows.
 */
export default function PriceWait({ className = "w-14" }: { className?: string }) {
  return (
    <span
      aria-label="Loading price"
      className={`inline-block h-[0.85em] animate-pulse rounded-md bg-snow/10 align-middle ${className}`}
    />
  );
}
