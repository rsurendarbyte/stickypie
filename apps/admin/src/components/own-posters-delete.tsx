"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "./toast";

/** When a customer's own posters go, and a way to delete them sooner. */
export default function OwnPostersDelete({
  orderId,
  delivered,
  deliveredAt,
  days,
}: {
  orderId: string;
  delivered: boolean;
  deliveredAt: string | null;
  days: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const goes = deliveredAt ? new Date(new Date(deliveredAt).getTime() + days * 86_400_000) : null;

  async function remove() {
    const warning = delivered
      ? "Delete the customer's own pictures now? A reprint would need them to send the pictures again."
      : "This order isn't delivered yet. Delete the customer's own pictures anyway? They can't be printed after this.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/own-posters`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not delete the pictures");
      toast("Pictures deleted");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the pictures", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-fog">
      {goes ? `Own pictures delete around ${goes.toLocaleDateString("en-IN")}.` : `Own pictures delete ${days} days after delivery.`}
      <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline disabled:opacity-50">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete now
      </button>
    </p>
  );
}
