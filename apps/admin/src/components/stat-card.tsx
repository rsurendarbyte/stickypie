export default function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-ink2 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-fog uppercase">{label}</p>
        {icon && <span className="text-fog/70">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      {sub && <div className="mt-1.5 text-xs text-fog">{sub}</div>}
    </div>
  );
}
