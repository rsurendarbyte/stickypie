import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewAuthorName, sameToken } from "@stickypie/shared";
import { getDriver } from "@/lib/data";

const PAID_LIKE = new Set(["paid", "packed", "shipped", "delivered"]);

const schema = z.object({
  orderId: z.string().uuid(),
  /** The key from the thank-you card's QR (stands in for signing in). */
  token: z.string().min(16).max(64),
  rating: z.number().int().min(1, "Pick 1 to 5 stars").max(5),
  body: z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters")
    .optional()
    .nullable()
    .transform((s) => s || null),
});

/**
 * Feedback from the thank-you card's QR: no sign-in, the order's random key
 * proves it's the customer. One rating covers the whole order (saved on each
 * sticker, pending admin approval). The admin reads it and decides on a
 * next-order offer in admin → Offers; nothing is promised here.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid feedback" }, { status: 400 });
  }
  const { orderId, token, rating, body: text } = parsed.data;

  const driver = getDriver();
  const order = await driver.getOrder(orderId);
  if (!order || !sameToken(token, order.feedbackToken)) {
    return NextResponse.json({ error: "This feedback link isn't valid." }, { status: 404 });
  }
  if (!PAID_LIKE.has(order.status)) {
    return NextResponse.json({ error: "This order can't be rated." }, { status: 409 });
  }

  const reviews = await driver.listOrderReviews(orderId);
  if (reviews.length > 0) {
    return NextResponse.json({ error: "You've already rated this order. Thank you!" }, { status: 409 });
  }
  // One review per sticker design (sizes merged); an all-custom order gets one on its first line.
  const lines = order.items.filter(
    (item, idx) => item.productId && order.items.findIndex((x) => x.productId === item.productId) === idx
  );
  const targets = lines.length ? lines : order.items.slice(0, 1);
  let saved = 0;
  for (const item of targets) {
    try {
      await driver.createReview({
        productId: item.productId,
        orderId,
        orderItemId: item.id,
        userId: order.userId,
        authorName: reviewAuthorName(order.customerName),
        rating,
        body: text,
        photoPath: null,
        photoUrl: null,
      });
      saved++;
    } catch (err) {
      console.error("[feedback]", err);
    }
  }
  if (saved === 0) {
    return NextResponse.json({ error: "Couldn't save your feedback. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ rating }, { status: 201 });
}
