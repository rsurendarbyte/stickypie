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
        className="pie-gradient mt-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
