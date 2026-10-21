"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Loader2, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { Order } from "@stickypie/shared";
import { useToast } from "./toast";

const NEXT_STEP: Partial<
  Record<Order["status"], { status: "packed" | "shipped" | "delivered"; label: string; icon: React.ElementType }>
> = {
  paid: { status: "packed", label: "Mark as packed", icon: PackageOpen },
  packed: { status: "shipped", label: "Mark as shipped", icon: Truck },
  shipped: { status: "delivered", label: "Mark as delivered", icon: PackageCheck },
};

export default function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const next = NEXT_STEP[order.status];
  const cancellable = ["pending", "paid", "packed"].includes(order.status);

  async function post(url: string, body?: unknown, success?: string) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Action failed");
      if (success) toast(success);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!next && !cancellable) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {next && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy("next");
            post(
              `/api/orders/${order.id}/status`,
              { status: next.status },
              `Order marked as ${next.status}`
            );
          }}
          className="pie-gradient flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {busy === "next" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <next.icon className="size-4" />
          )}
          {next.label}
        </button>
      )}
      {cancellable && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            const restockNote =
              order.status === "pending"
                ? "Cancel this order?"
                : "Cancel this order? Paid items will be restocked.";
            if (!confirm(restockNote)) return;
            setBusy("cancel");
            post(`/api/orders/${order.id}/cancel`, undefined, "Order cancelled");
          }}
          className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-5 py-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand/20 disabled:opacity-60"
        >
          {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
          Cancel order
        </button>
      )}
    </div>
  );
}
