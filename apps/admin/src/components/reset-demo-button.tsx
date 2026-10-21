"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useToast } from "./toast";

export default function ResetDemoButton() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function reset() {
    if (
      !confirm(
        "Reset the demo store? All products, categories and orders go back to the seed catalog."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dev/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Reset failed");
      toast("Demo data reset to the seed catalog");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reset}
      disabled={busy}
      className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-5 py-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand/20 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      Reset demo data
    </button>
  );
}
