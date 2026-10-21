import { NextResponse } from "next/server";
import {
  REVIEW_PHOTO_BUCKET,
  REVIEW_PHOTO_MAX_BYTES,
  reviewAuthorName,
  reviewInputSchema,
} from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { supabaseConfigured, supabaseUrl } from "@/lib/mode";
import { shopperFromRequest } from "@/lib/shopper";

const PHOTO_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

function storageHeaders(contentType?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, ...(contentType ? { "Content-Type": contentType } : {}) };
}

/** Stores the (already shrunk) photo under a random name; returns its path + public URL. */
async function uploadPhoto(photo: File, productId: string | null) {
  const path = `${productId ?? "misc"}/${crypto.randomUUID()}.${PHOTO_TYPES[photo.type]}`;
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${REVIEW_PHOTO_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...storageHeaders(photo.type), "cache-control": "public, max-age=31536000, immutable" },
    body: await photo.arrayBuffer(),
  });
  if (!res.ok) throw new Error(`photo upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { path, url: `${supabaseUrl()}/storage/v1/object/public/${REVIEW_PHOTO_BUCKET}/${path}` };
}

async function deletePhoto(path: string) {
  await fetch(`${supabaseUrl()}/storage/v1/object/${REVIEW_PHOTO_BUCKET}/${path}`, {
    method: "DELETE",
    headers: storageHeaders(),
  }).catch(() => {});
}

/**
 * A shopper reviews a sticker they bought. Allowed only for their own order,
 * only once it's delivered, once per order line. Starts "pending" until an
 * admin approves it.
 */
export async function POST(req: Request) {
  const shopper = await shopperFromRequest(req);
  if (!shopper) {
    return NextResponse.json({ error: "Please sign in to leave a review.", code: "auth_required" }, { status: 401 });
  }
  // multipart/form-data (with an optional photo) or plain JSON.
  let body: unknown;
  let photo: File | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      body = {
        orderId: form.get("orderId"),
        scope: form.get("scope") || "item",
        orderItemId: form.get("orderItemId") || undefined,
        rating: Number(form.get("rating")),
        body: form.get("body") || null,
      };
      const file = form.get("photo");
      if (file instanceof File && file.size > 0) photo = file;
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (photo) {
    if (!PHOTO_TYPES[photo.type]) {
      return NextResponse.json({ error: "Photo must be a JPG, PNG or WebP image." }, { status: 400 });
    }
    if (photo.size > REVIEW_PHOTO_MAX_BYTES) {
      return NextResponse.json({ error: "That photo is too large — please pick a smaller one." }, { status: 413 });
    }
  }
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review" }, { status: 400 });
  }
  const { orderId, orderItemId, scope, rating, body: text } = parsed.data;

  const driver = getDriver();
  const order = await driver.getOrder(orderId);
  if (!order || order.userId !== shopper.id) {
    return NextResponse.json({ error: "We couldn't find that order on your account." }, { status: 404 });
  }
  if (order.status !== "delivered") {
    return NextResponse.json({ error: "You can review stickers once your order is delivered." }, { status: 409 });
  }
  // Which order lines this review covers: one sticker, or every sticker in the
  // order that hasn't been reviewed yet (one line per sticker, even across sizes).
  const lines = order.items.filter(
    (item, idx) => item.productId && order.items.findIndex((x) => x.productId === item.productId) === idx
  );
  let targets = scope === "order" ? lines : order.items.filter((i) => i.id === orderItemId);
  if (targets.length === 0) {
    return NextResponse.json({ error: "That sticker isn't part of this order." }, { status: 404 });
  }
  if (scope === "order") {
    const done = new Set(
      (await driver.listOrderReviews(orderId)).map((r) => order.items.find((i) => i.id === r.orderItemId)?.productId)
    );
    targets = targets.filter((t) => !done.has(t.productId));
    if (targets.length === 0) {
      return NextResponse.json({ error: "You've already reviewed every sticker in this order." }, { status: 409 });
    }
  }

  let stored: { path: string; url: string } | null = null;
  if (photo && supabaseConfigured()) {
    try {
      stored = await uploadPhoto(photo, targets.length === 1 ? targets[0].productId : `orders/${orderId}`);
    } catch (err) {
      console.error("[reviews]", err);
      return NextResponse.json({ error: "Couldn't upload your photo. Please try again." }, { status: 502 });
    }
  }

  const created: string[] = [];
  let lastError = "Couldn't save your review.";
  for (const item of targets) {
    try {
      const review = await driver.createReview({
        productId: item.productId,
        orderId,
        orderItemId: item.id,
        userId: shopper.id,
        authorName: reviewAuthorName(order.customerName),
        rating,
        body: text,
        // One photo shared by every review from this submission.
        photoPath: stored?.path ?? null,
        photoUrl: stored?.url ?? null,
      });
      created.push(review.id);
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
  }
  if (created.length === 0) {
    if (stored) await deletePhoto(stored.path); // don't leave an orphan photo behind
    return NextResponse.json({ error: lastError }, { status: /already/.test(lastError) ? 409 : 500 });
  }
  return NextResponse.json({ reviewed: created.length, status: "pending" }, { status: 201 });
}
