import { STATUS_LABELS, type OrderStatus } from "@stickypie/shared";

const STYLES: Record<OrderStatus, string> = {
  pending: "border-gold/30 bg-gold/10 text-gold",
  paid: "border-mint/30 bg-mint/10 text-mint",
  failed: "border-brand/40 bg-brand/10 text-brand",
  packed: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  shipped: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  delivered: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  cancelled: "border-line bg-white/5 text-fog",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
