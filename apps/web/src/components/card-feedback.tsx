"use client";

import Link from "@/components/page-link";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { TextAreaField } from "./field";
import StarPicker, { Stars } from "./star-rating";

type Done = { rating: number; body: string | null };

/**
 * Feedback opened from the thank-you card's QR (no sign-in: the link's key
 * stands in). One rating for the whole order. Any offer comes later: the shop
 * reads the feedback and approves it in admin, then it shows on the customer's
 * account and at their next checkout.
 */
export default function CardFeedback({
  orderId,
  token,
  firstName,
  images,
  initial,
}: {
  orderId: string;
  token: string;
  firstName: string;
  images: string[];
  initial: Done | null;
}) {
  const [done, setDone] = useState<Done | null>(initial);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLElement>(null);

  // Opened from the QR (…#feedback): bring the box into view once the page has laid out.
  useEffect(() => {
    if (window.location.hash !== "#feedback") return;
    const t = setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    if (rating < 1) {
      setError("Tap the stars to rate your order.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token, rating, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't save your feedback.");
      setDone({ rating: (data as Done).rating, body: body.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      ref={box}
      id="feedback"
      className="mb-5 scroll-mt-20 overflow-hidden rounded-2xl border border-brand/30 bg-ink2"
    >
      <div className="pie-gradient h-1.5" />
      <div className="p-5">
        {done ? (
          <Thanks done={done} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              {images.length > 0 && (
                <div className="flex shrink-0 -space-x-3">
                  {images.slice(0, 3).map((src) => (
                    <span
                      key={src}
                      className="grid size-11 place-items-center rounded-lg bg-panel p-1 ring-2 ring-ink2"
                    >
                      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                    </span>
                  ))}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-display text-xl leading-tight font-semibold">
                  How did we do{firstName ? `, ${firstName}` : ""}?
                </h2>
                <p className="mt-0.5 text-sm text-fog">
                  Takes 20 seconds. We read every one.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <StarPicker
                value={rating}
                onChange={(n) => {
                  setRating(n);
                  setError(null);
                }}
              />
              <TextAreaField
                label={rating > 0 && rating < 4 ? "What should we do better? (optional)" : "Anything you'd like to tell us? (optional)"}
                rows={3}
                value={body}
                maxLength={1000}
                onChange={(e) => setBody(e.target.value)}
              />
              {error && <p className="text-sm font-medium text-brand">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="peel-btn inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold disabled:opacity-60 sm:w-auto sm:px-8"
              >
                {saving ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Thanks({ done }: { done: Done }) {
  const happy = done.rating >= 4;
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">Thanks for telling us!</h2>
      <Stars value={done.rating} className="mt-1.5" />
      {done.body && <p className="mt-2 text-sm text-fog">&ldquo;{done.body}&rdquo;</p>}
      <p className="mt-2 text-sm text-fog">
        {happy
          ? "We're so glad you liked them."
          : "Sorry it wasn't perfect. We'll get in touch to make it right."}{" "}
        Once we&apos;ve read it, your thank-you offer shows up in your account and is taken off at your next checkout.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/stickers"
          className="peel-btn inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold"
        >
          <ShoppingBag className="peel-icon size-4" /> Browse stickers
        </Link>
        {!happy && (
          <Link
            href="/contact"
            className="peel-btn peel-btn--light inline-flex h-11 items-center rounded-xl px-5 text-sm font-bold"
          >
            Message us
          </Link>
        )}
      </div>
    </div>
  );
}
