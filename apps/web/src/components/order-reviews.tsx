"use client";

import Link from "@/components/page-link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock3, X, XCircle } from "lucide-react";
import type { OrderItem, ReviewStatus } from "@stickypie/shared";
import { authClient, useShopper } from "@/lib/shopper-auth";
import { shrinkImage } from "@/lib/shrink-image";
import { TextAreaField } from "./field";
import StarPicker, { Stars } from "./star-rating";
import StickerLoader from "./sticker-loader";

type Existing = {
  orderItemId: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  photoUrl: string | null;
};

const STATUS: Record<ReviewStatus, { label: string; icon: typeof Clock3; cls: string }> = {
  pending: { label: "Waiting for approval", icon: Clock3, cls: "bg-gold/10 text-gold" },
  approved: { label: "Published", icon: CheckCircle2, cls: "bg-mint/10 text-mint" },
  rejected: { label: "Not published", icon: XCircle, cls: "bg-panel text-fog" },
};

/**
 * Feedback on a delivered order: rate the whole order at once (default) or
 * each sticker separately. Every review shows on its sticker's page once an
 * admin approves it.
 */
export default function OrderReviews({
  orderId,
  orderUserId,
  items,
}: {
  orderId: string;
  orderUserId: string | null;
  items: OrderItem[];
}) {
  const shopper = useShopper();
  const [existing, setExisting] = useState<Existing[] | null>(null);
  const [mode, setMode] = useState<"order" | "each">("order");
  const userId = shopper.session?.user.id ?? null;

  // One entry per sticker, even if bought in two sizes.
  const lines = items.filter(
    (item, i) => item.productId && items.findIndex((x) => x.productId === item.productId) === i
  );

  const load = useCallback(() => {
    authClient()!
      .from("product_reviews")
      .select("order_item_id,rating,body,status,photo_url")
      .eq("order_id", orderId)
      .then(({ data }) =>
        setExisting(
          (data ?? []).map((r) => ({
            orderItemId: r.order_item_id as string,
            rating: Number(r.rating),
            body: (r.body as string | null) ?? null,
            status: r.status as ReviewStatus,
            photoUrl: (r.photo_url as string | null) ?? null,
          }))
        )
      );
  }, [orderId]);

  useEffect(() => {
    if (userId && userId === orderUserId) load();
  }, [userId, orderUserId, load]);

  if (!shopper.enabled || !orderUserId || lines.length === 0 || !shopper.ready) return null;
  if (!userId) {
    return (
      <section className="mt-5 rounded-2xl border border-line bg-ink2 p-5 text-center">
        <p className="font-display text-lg font-semibold">How was your order?</p>
        <Link href="/account" className="mt-1 inline-block text-sm font-semibold text-brand hover:underline">
          Sign in to leave feedback →
        </Link>
      </section>
    );
  }
  if (userId !== orderUserId) return null;

  const reviewOf = (item: OrderItem) =>
    existing?.find((r) => items.some((i) => i.id === r.orderItemId && i.productId === item.productId));
  const toReview = lines.filter((item) => !reviewOf(item));
  const reviewed = lines.filter((item) => reviewOf(item));
  const showToggle = toReview.length > 1;
  const auth = shopper.session?.access_token ?? "";

  return (
    <section className="mt-5 rounded-2xl border border-line bg-ink2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {toReview.length === 0 ? "Thanks for your feedback!" : "How was your order?"}
          </h2>
          <p className="mt-0.5 text-sm text-fog">
            Your review helps other sticker lovers — it shows on the sticker page once approved.
          </p>
        </div>
        {showToggle && (
          <div role="tablist" className="inline-flex rounded-full border border-line bg-ink p-0.5 text-xs font-semibold">
            {(
              [
                ["order", "Whole order"],
                ["each", "Each sticker"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  mode === key ? "pie-gradient text-white" : "text-fog hover:text-snow"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!existing ? (
        <div className="grid place-items-center py-8">
          <StickerLoader size={40} />
        </div>
      ) : (
        <>
          {toReview.length > 0 && (mode === "order" || toReview.length === 1) && (
            <div className="mt-4 rounded-xl border border-line bg-ink p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {toReview.slice(0, 5).map((item) => (
                    <span
                      key={item.id}
                      className="grid size-11 place-items-center rounded-lg bg-panel p-1 ring-2 ring-ink"
                    >
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />}
                    </span>
                  ))}
                </div>
                <p className="min-w-0 text-sm font-semibold">
                  {toReview.length === 1
                    ? toReview[0].name
                    : `Rate all ${toReview.length} stickers at once`}
                  {toReview.length > 1 && (
                    <span className="block truncate text-xs font-normal text-fog">
                      {toReview.map((i) => i.name).join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <ReviewForm
                authToken={auth}
                fields={
                  toReview.length === 1
                    ? { orderId, scope: "item", orderItemId: toReview[0].id }
                    : { orderId, scope: "order" }
                }
                onSaved={load}
              />
            </div>
          )}

          {toReview.length > 1 && mode === "each" && (
            <ul className="mt-4 space-y-3">
              {toReview.map((item) => (
                <li key={item.id} className="rounded-xl border border-line bg-ink p-3.5">
                  <StickerHeading item={item} />
                  <ReviewForm
                    authToken={auth}
                    fields={{ orderId, scope: "item", orderItemId: item.id }}
                    onSaved={load}
                  />
                </li>
              ))}
            </ul>
          )}

          {reviewed.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {reviewed.map((item) => {
                const r = reviewOf(item)!;
                return (
                  <li key={item.id} className="rounded-xl border border-line bg-ink p-3.5">
                    <StickerHeading item={item} status={r.status} />
                    <div className="mt-2 pl-[60px]">
                      <Stars value={r.rating} />
                      {r.body && <p className="mt-1 text-sm text-fog">{r.body}</p>}
                      {r.photoUrl && (
                        <img src={r.photoUrl} alt="Your photo" className="mt-2 h-20 rounded-lg border border-line object-cover" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function StickerHeading({ item, status }: { item: OrderItem; status?: ReviewStatus }) {
  const s = status ? STATUS[status] : null;
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-panel p-1">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</p>
      {s && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>
          <s.icon className="size-3.5" /> {s.label}
        </span>
      )}
    </div>
  );
}

/** Stars + comment + one photo (shrunk in the browser), then submit. */
function ReviewForm({
  authToken,
  fields,
  onSaved,
}: {
  authToken: string;
  fields: { orderId: string; scope: "item" | "order"; orderItemId?: string };
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setShrinking(true);
    try {
      const small = await shrinkImage(file);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ file: small, preview: URL.createObjectURL(small) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that photo.");
    } finally {
      setShrinking(false);
    }
  }

  async function submit() {
    if (rating < 1) {
      setError("Tap the stars to rate it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("orderId", fields.orderId);
      form.set("scope", fields.scope);
      if (fields.orderItemId) form.set("orderItemId", fields.orderItemId);
      form.set("rating", String(rating));
      form.set("body", body);
      if (photo) form.set("photo", photo.file);
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't save your review.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your review.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 sm:pl-[60px]">
      <StarPicker
        value={rating}
        onChange={(n) => {
          setRating(n);
          setError(null);
        }}
      />
      <TextAreaField
        label="Tell others what you think (optional)"
        rows={2}
        value={body}
        maxLength={1000}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        {photo ? (
          <span className="relative inline-block">
            <img src={photo.preview} alt="Your photo" className="h-20 rounded-lg border border-line object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => {
                URL.revokeObjectURL(photo.preview);
                setPhoto(null);
              }}
              className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-snow text-white shadow"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={shrinking}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-line px-3.5 py-2 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-60"
          >
            {shrinking ? <StickerLoader size={16} /> : <Camera className="size-4" />}
            {shrinking ? "Preparing photo…" : "Add a photo (optional)"}
          </button>
        )}
        {photo && <span className="text-[11px] text-fog">{Math.round(photo.file.size / 1024)} KB · 1 photo max</span>}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-brand">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="peel-btn peel-btn--brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-70"
      >
        {saving && <StickerLoader size={16} variant="onBrand" />}
        {fields.scope === "order" ? "Submit feedback" : "Submit review"}
      </button>
    </div>
  );
}
