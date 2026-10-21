import { Check, ExternalLink } from "lucide-react";
import type { Order } from "@stickypie/shared";
import { formatDateTime } from "@stickypie/shared";

const REACHED: Record<string, number> = { paid: 1, packed: 2, shipped: 3, delivered: 4 };

/** Placed → Paid → Packed → Shipped (courier + tracking) → Delivered. */
export default function OrderTracking({ order }: { order: Order }) {
  const reached = REACHED[order.status] ?? 0;
  const steps = [
    { label: "Order placed", at: order.createdAt },
    { label: "Payment confirmed", at: order.paidAt },
    { label: "Packed", at: order.packedAt },
    { label: "Shipped", at: order.shippedAt },
    { label: "Delivered", at: order.deliveredAt },
  ];

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const done = i <= reached;
        const current = i === reached && reached < steps.length - 1;
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-0.5 ${
                  i < reached ? "bg-mint" : "bg-line"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${
                done ? "bg-mint text-white" : "border-2 border-line bg-ink"
              } ${current ? "ring-4 ring-mint/20" : ""}`}
            >
              {done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-semibold ${done ? "text-snow" : "text-fog/70"}`}>
                {step.label}
              </p>
              {done && step.at && <p className="text-xs text-fog">{formatDateTime(step.at)}</p>}
              {i === 3 && done && order.courier && (
                <p className="mt-1 text-xs text-fog">
                  {order.courier} · tracking no.{" "}
                  <span className="font-semibold text-snow">{order.trackingNumber}</span>
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                    >
                      Track parcel <ExternalLink className="size-3" />
                    </a>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
