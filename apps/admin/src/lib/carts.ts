// Shoppers' carts for the admin's Carts page, from the admin_carts() database
// function. Kept apart from orders: nothing here counts as a sale.
import type { OrderStatus } from "@stickypie/shared";
import { supabaseConfigured } from "./auth";
import { getAdminDriver } from "./data";
import { createServerSupabase } from "./supabase";

export type CartLine = { id: string | null; name: string; size: string | null; qty: number; price: number; thumb?: string | null };

export type Cart = {
  id: string;
  status: "pending" | "ordered";
  items: CartLine[];
  item_count: number;
  value: number;
  /** Roughly where it came from: "Chennai, Tamil Nadu". Null for older carts. */
  place: string | null;
  user_id: string | null;
  order_id: string | null;
  order_status: OrderStatus | null;
  created_at: string;
  updated_at: string;
  ordered_at: string | null;
  email: string | null;
  name: string | null;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function listCarts(): Promise<Cart[]> {
  if (!supabaseConfigured()) return [];
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("admin_carts");
  if (error) throw new Error(error.message);
  const carts = (data ?? []) as Cart[];

  // Pictures come from the catalogue, by product id (a customized wall's line id holds its wall's).
  const lineProduct = (line: CartLine) => line.id?.match(UUID)?.[0] ?? null;
  const ids = [...new Set(carts.flatMap((c) => c.items.flatMap((l) => lineProduct(l) ?? [])))];
  const driver = await getAdminDriver();
  const products = new Map((ids.length ? await driver.getProductsByIds(ids) : []).map((p) => [p.id, p]));
  return carts.map((c) => {
    const items = c.items.map((l) => {
      const product = products.get(lineProduct(l) ?? "");
      // A waiting cart keeps the price from when it was filled, but one-price items
      // (wall sets) would be charged today's. Ordered carts stay as they were sold.
      const price = c.status === "pending" && product?.sizes.length === 0 ? product.price : l.price;
      return { ...l, price, thumb: product?.thumbUrl ?? product?.imageUrl ?? null };
    });
    return { ...c, items, value: c.status === "pending" ? items.reduce((sum, l) => sum + l.qty * l.price, 0) : c.value };
  });
}

/** For the Orders page: 0 if the count can't be read, it's only a shortcut. */
export async function pendingCartCount(): Promise<number> {
  if (!supabaseConfigured()) return 0;
  const db = await createServerSupabase();
  const { count } = await db.from("carts").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
