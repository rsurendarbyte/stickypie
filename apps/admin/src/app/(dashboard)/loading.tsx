// Shown the moment a menu item is clicked, while the page loads its data.
export default function Loading() {
  return (
    <div className="w-full animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-white/10" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-white/5" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-white/5" />
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-2xl border border-line bg-ink2 p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
