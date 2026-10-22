"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Star, Trash2, X } from "lucide-react";
import { orderCode, type Review, type ReviewStatus } from "@stickypie/shared";
import { imageSrc } from "@/lib/img";
import { useToast } from "./toast";

type ProductInfo = Record<string, { name: string; imageUrl: string; slug: string }>;

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

export default function ReviewsManager({ initial, products }: { initial: Review[]; products: ProductInfo }) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState(initial);
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = reviews.filter((r) => r.status === tab);

  async function setStatus(r: Review, status: ReviewStatus) {
    setBusy(r.id);
    const res = await fetch(`/api/reviews/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) return toast("Couldn't update the review", "error");
    setReviews((list) =>
      list.map((x) =>
        x.id === r.id ? { ...x, status, ...(status === "rejected" ? { photoUrl: null, photoPath: null } : {}) } : x
      )
    );
    toast(
      status === "approved"
        ? "Published on the sticker page"
        : status === "rejected"
          ? "Rejected — photo removed"
          : "Moved back to waiting"
    );
  }

  async function remove(r: Review) {
    if (!confirm("Delete this review (and its photo) permanently?")) return;
    setBusy(r.id);
    const res = await fetch(`/api/reviews/${r.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast("Couldn't delete the review", "error");
    setReviews((list) => list.filter((x) => x.id !== r.id));
    toast("Review deleted");
  }

  return (
    <>
      <div className="flex gap-1.5">
        {TABS.map((t) => {
          const n = reviews.filter((r) => r.status === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "pie-gradient text-white" : "border border-line text-fog hover:text-snow"
              }`}
            >
              {t.label} <span className="opacity-75">({n})</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fog">
          {tab === "pending" ? "No reviews waiting — you're all caught up." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => {
            const product = r.productId ? products[r.productId] : undefined;
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-ink2 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-panel p-1">
                    {product?.imageUrl && (
                      <img src={imageSrc(product.imageUrl)} alt="" className="max-h-full max-w-full object-contain" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product?.name ?? "Deleted sticker"}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fog">
                      <span className="inline-flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`size-3.5 ${n <= r.rating ? "text-gold" : "text-line"}`}
                            fill="currentColor"
                            strokeWidth={0}
                          />
                        ))}
                      </span>
                      <span>{r.authorName}</span>
                      <span>· {new Date(r.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                      <Link href={`/orders/${r.orderId}`} className="text-brand hover:underline">
                        · {orderCode(r.orderId)}
                      </Link>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-snow/90">
                      {r.body ?? <span className="text-fog italic">No comment — stars only</span>}
                    </p>
                    {r.photoUrl && (
                      <a href={r.photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                        <img
                          src={r.photoUrl}
                          alt="Shopper's photo"
                          className="h-28 rounded-lg border border-line object-cover"
                        />
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {r.status !== "approved" && (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => setStatus(r, "approved")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25 disabled:opacity-50"
                    >
                      <Check className="size-3.5" /> Approve
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => setStatus(r, "rejected")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fog hover:text-snow disabled:opacity-50"
                    >
                      <X className="size-3.5" /> {r.status === "approved" ? "Unpublish" : "Reject"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => remove(r)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-fog hover:text-brand disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
