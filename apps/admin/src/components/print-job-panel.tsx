"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, ExternalLink, Link2Off, Loader2, Printer } from "lucide-react";
import type { Order } from "@stickypie/shared";
import { useToast } from "./toast";

/**
 * Print job for the printing person: a public link (on a neutral address when set) with the
 * stickers, their files and A3 sheets (no prices). It closes by itself once
 * the order is marked packed.
 */
export default function PrintJobPanel({ order, webUrl }: { order: Order; webUrl: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [token, setToken] = useState(order.printToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const open = order.status === "paid";
  if (!open && !token) return null;
  // The printer gets the neutral print address when one is set (infra/print-desk), else the shop's own.
  const printUrl = process.env.NEXT_PUBLIC_PRINT_URL?.replace(/\/+$/, "");
  const link = token ? (printUrl ? `${printUrl}/j/${token}` : `${webUrl}/print-job/${token}`) : "";

  async function save(off: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/print-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ off }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update the print job");
      setToken(data.token ?? null);
      toast(off ? "Print job link switched off" : "Print job link ready");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update the print job", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-ink2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Printer className="size-4 text-brand" />
        <h2 className="text-sm font-semibold">Print job</h2>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
            token && open ? "bg-mint/15 text-mint" : "bg-white/10 text-fog"
          }`}
        >
          {token ? (open ? "Link active" : "Closed — order packed") : "No job yet"}
        </span>
      </div>
      <p className="mt-1 text-xs text-fog">
        A link for the printing person: stickers, sizes, quantities, files to download and A3 sheets. No prices.
        It stops working once you mark the order packed.
      </p>
      {token && open ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink px-2.5 font-mono text-xs text-snow outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand/50 hover:text-brand"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Print job ${link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand/50 hover:text-brand"
            >
              Send on WhatsApp
            </a>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand/50 hover:text-brand"
            >
              <ExternalLink className="size-4" /> Open
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => save(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fog hover:text-snow disabled:opacity-60"
            >
              New link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-fog hover:text-snow disabled:opacity-60"
            >
              <Link2Off className="size-4" /> Switch off
            </button>
          </div>
        </div>
      ) : open ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => save(false)}
          className="pie-gradient mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand/25 hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} Create print job
        </button>
      ) : null}
    </section>
  );
}
