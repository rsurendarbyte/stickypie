"use client";

import { useEffect } from "react";
import { trackMeta, trackMetaOnce } from "@/lib/meta-pixel";

/** ViewContent for the sticker (or offer) a page is about. */
export function MetaViewContent({
  id,
  name,
  price,
  category,
}: {
  id: string;
  name: string;
  price: number;
  category?: string;
}) {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_ids: [id],
      content_name: name,
      content_type: "product",
      content_category: category,
      value: price,
      currency: "INR",
    });
  }, [id, name, price, category]);
  return null;
}

/** Purchase, once per paid order (the order page can be reopened or refreshed). */
export function MetaPurchase({
  orderId,
  paid,
  total,
  items,
}: {
  orderId: string;
  paid: boolean;
  total: number;
  items: { id: string; qty: number; price: number }[];
}) {
  useEffect(() => {
    if (!paid) return;
    trackMetaOnce(
      `purchase.${orderId}`,
      "Purchase",
      {
        value: total,
        currency: "INR",
        content_type: "product",
        content_ids: items.map((i) => i.id),
        contents: items.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })),
        num_items: items.reduce((n, i) => n + i.qty, 0),
      },
      orderId
    );
  }, [paid, orderId, total, items]);
  return null;
}
