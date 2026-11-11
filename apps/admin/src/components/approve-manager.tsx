"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Pencil, TrendingUp, X } from "lucide-react";
import { formatINR, isWallDataTag } from "@stickypie/shared";
import { imageSrc } from "@/lib/img";
import { DRAFT_TAG } from "@/lib/drafts";
import { useToast } from "./toast";

export type Draft = {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  compareAtPrice: number | null;
  posters: number;
  trend: string | null;
  tags: string[];
};

const shortName = (name: string) => name.replace(/ Wall Setup.*$| — .*$/, "");

export default function ApproveManager({ initial }: { initial: Draft[] }) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function release(d: Draft) {
    setBusy(d.id);
    // the wall's own data tags are kept by the API; only the draft tag goes
    const tags = d.tags.filter((t) => t !== DRAFT_TAG && !isWallDataTag(t));
    const res = await fetch(`/api/products/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true, tags }),
    });
    setBusy(null);
    if (!res.ok) return toast((await res.json().catch(() => null))?.error ?? "Couldn't release it", "error");
    setDrafts((list) => list.filter((x) => x.id !== d.id));
    toast(`${shortName(d.name)} is live in the shop`);
  }

  async function reject(d: Draft) {
    if (!confirm(`Delete "${shortName(d.name)}"? It was never in the shop.`)) return;
    setBusy(d.id);
    const res = await fetch(`/api/products/${d.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast((await res.json().catch(() => null))?.error ?? "Couldn't delete it", "error");
    setDrafts((list) => list.filter((x) => x.id !== d.id));
    toast("Deleted");
  }

  if (!drafts.length)
    return (
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
        Nothing waiting. New walls arrive every morning.
      </p>
    );

  return (
    <>
      <p className="mb-3 text-xs font-semibold text-fog">{drafts.length} waiting</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drafts.map((d) => (
          <li key={d.id} className="overflow-hidden rounded-2xl border border-line bg-ink2">
            <a href={imageSrc(d.imageUrl)} target="_blank" rel="noreferrer" className="block aspect-square bg-panel">
              <img src={imageSrc(d.imageUrl)} alt={d.name} loading="lazy" className="size-full object-cover" />
            </a>
            <div className="p-3">
              <p className="truncate text-sm font-semibold">{shortName(d.name)}</p>
              <p className="mt-0.5 text-xs text-fog">
                {d.posters} posters · <span className="font-semibold text-snow">{formatINR(d.price)}</span>
                {d.compareAtPrice ? <span className="ml-1 line-through">{formatINR(d.compareAtPrice)}</span> : null}
              </p>
              {d.trend && (
                <p className="mt-1 flex items-center gap-1 text-xs text-brand">
                  <TrendingUp className="size-3.5 shrink-0" /> <span className="truncate">Trending: {d.trend}</span>
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === d.id}
                  onClick={() => release(d)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-mint/15 py-2 text-xs font-bold text-mint hover:bg-mint/25 disabled:opacity-50"
                >
                  <Check className="size-4" /> Release
                </button>
                <Link
                  href={`/products/${d.id}/edit`}
                  aria-label="Edit"
                  className="grid w-10 place-items-center rounded-lg border border-line text-fog hover:text-snow"
                >
                  <Pencil className="size-4" />
                </Link>
                <button
                  type="button"
                  disabled={busy === d.id}
                  onClick={() => reject(d)}
                  aria-label="Reject"
                  className="grid w-10 place-items-center rounded-lg border border-line text-fog hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
