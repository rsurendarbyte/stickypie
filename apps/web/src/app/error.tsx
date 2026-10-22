"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-2xl font-semibold">Something came unstuck</p>
      <p className="max-w-md text-sm text-fog">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={reset}
        className="peel-btn peel-btn--brand mt-2 rounded-xl px-6 py-2.5 text-sm font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
