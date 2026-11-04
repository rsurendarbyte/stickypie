// Most viewed sticker pages for the admin's Analytics page, from our own
// counter (public.product_views, filled by the shop), next to how many of each
// were sold in the same days — so stickers people look at but don't buy stand out.
import { createServerSupabase } from "./supabase";
import type { Range } from "./analytics";

const IST_MS = 5.5 * 3600_000;
const DAY_MS = 86_400_000;
const PAID = ["paid", "packed", "shipped", "delivered"];

export type ViewedProduct = { id: string; name: string; slug: string; thumb: string | null; views: number; saves: number; sold: number };
export type ProductViews = { total: number; saves: number; products: ViewedProduct[] };

export async function getProductViews(range: Range, limit = 15): Promise<ProductViews> {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const startMs = Math.floor((Date.now() + IST_MS) / DAY_MS) * DAY_MS - (days - 1) * DAY_MS;
  const fromDay = new Date(startMs).toISOString().slice(0, 10);
  const fromInstant = new Date(startMs - IST_MS).toISOString();

  const db = await createServerSupabase();
  const [views, sales] = await Promise.all([
    db.from("product_views").select("product_id, views, saves").gte("day", fromDay),
    db
      .from("order_items")
      .select("product_id, quantity, orders!inner(status, created_at)")
      .in("orders.status", PAID)
      .gte("orders.created_at", fromInstant),
  ]);
  if (views.error) throw new Error(views.error.message);

  const viewed = new Map<string, number>();
  const saved = new Map<string, number>();
  for (const r of views.data ?? []) {
    viewed.set(r.product_id, (viewed.get(r.product_id) ?? 0) + r.views);
    if (r.saves) saved.set(r.product_id, (saved.get(r.product_id) ?? 0) + r.saves);
  }
  const sold = new Map<string, number>();
  for (const r of sales.data ?? []) if (r.product_id) sold.set(r.product_id, (sold.get(r.product_id) ?? 0) + (r.quantity ?? 0));

  const top = [...viewed.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const { data: products } = top.length
    ? await db.from("products").select("id, name, slug, thumb_url").in("id", top.map(([id]) => id))
    : { data: [] };
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  return {
    total: [...viewed.values()].reduce((a, b) => a + b, 0),
    saves: [...saved.values()].reduce((a, b) => a + b, 0),
    products: top.map(([id, v]) => {
      const p = byId.get(id);
      return { id, name: p?.name ?? "Removed sticker", slug: p?.slug ?? "", thumb: p?.thumb_url ?? null, views: v, saves: saved.get(id) ?? 0, sold: sold.get(id) ?? 0 };
    }),
  };
}
