// Home page layout: an ordered list of product rails, edited in the admin.
// Browser-safe, no deps — the storefront resolves rails against the live
// (on-sale only) catalog, so hidden products never appear in any rail.
import { z } from "zod";
import type { Category, Product } from "./types";
import { inCategory } from "./utils";

export type HomeRailKind = "custom" | "featured" | "new" | "category" | "categories";

export type HomeRail = {
  id: string;
  kind: HomeRailKind;
  /** Shown above the rail; for "category" an empty title uses the category name. */
  title: string;
  /** "category" rails only. */
  categoryId: string | null;
  /**
   * "custom" rails: the stickers, in this order. Other rails: pinned stickers
   * shown first (in this order), then the automatic ones fill the rest.
   * "categories": a pinned sticker leads its own category's rail.
   */
  productIds: string[];
  visible: boolean;
  /** Most stickers shown in the rail. */
  limit: number;
};

export const HOME_RAIL_KINDS: Record<HomeRailKind, { label: string; hint: string }> = {
  custom: { label: "Hand-picked", hint: "Stickers you choose, in your order" },
  featured: { label: "Top picks", hint: "Products marked Featured" },
  new: { label: "New drops", hint: "Newest stickers first" },
  category: { label: "One category", hint: "Stickers from one category" },
  categories: { label: "All categories", hint: "A rail for every category with stickers" },
};

export const DEFAULT_HOME_RAILS: HomeRail[] = [
  { id: "top-picks", kind: "featured", title: "Top Picks This Week", categoryId: null, productIds: [], visible: true, limit: 10 },
  { id: "new-drops", kind: "new", title: "New Drops", categoryId: null, productIds: [], visible: true, limit: 10 },
  { id: "all-categories", kind: "categories", title: "", categoryId: null, productIds: [], visible: true, limit: 12 },
];

export const homeRailsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      kind: z.enum(["custom", "featured", "new", "category", "categories"]),
      title: z.string().trim().max(60),
      categoryId: z.string().nullable(),
      productIds: z.array(z.string()).max(40),
      visible: z.boolean(),
      limit: z.number().int().min(1).max(40),
    })
  )
  .max(30)
  .superRefine((rails, ctx) => {
    rails.forEach((rail, i) => {
      if (rail.kind === "category" && !rail.categoryId) {
        ctx.addIssue({ code: "custom", path: [i, "categoryId"], message: "Choose a category for each category rail" });
      }
      if ((rail.kind === "custom" || rail.kind === "featured" || rail.kind === "new") && !rail.title) {
        ctx.addIssue({ code: "custom", path: [i, "title"], message: "Give every rail a title" });
      }
    });
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToHomeRails(value: any): HomeRail[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_RAILS;
  const parsed = homeRailsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_HOME_RAILS;
}

export type ResolvedRail = { key: string; title: string; href?: string; items: Product[] };

/**
 * Turns the layout into rails of products. `products` must be the on-sale
 * catalog, newest first. Hidden rails and rails with nothing to show are dropped.
 */
export function resolveHomeRails(
  rails: HomeRail[],
  products: Product[],
  categories: Category[]
): ResolvedRail[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const explicitCategories = new Set(
    rails.filter((r) => r.visible && r.kind === "category" && r.categoryId).map((r) => r.categoryId)
  );
  const out: ResolvedRail[] = [];
  // Pinned (on-sale) stickers first, then the automatic list without repeats.
  const pinnedFirst = (pins: string[], auto: Product[]) => {
    const pinned = pins.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
    const seen = new Set(pinned.map((p) => p.id));
    return [...pinned, ...auto.filter((p) => !seen.has(p.id))];
  };

  for (const rail of rails) {
    if (!rail.visible) continue;
    if (rail.kind === "categories") {
      for (const category of categories) {
        if (explicitCategories.has(category.id)) continue;
        const inThis = (p: Product) => inCategory(p, category.id);
        const pins = rail.productIds.filter((id) => byId.get(id) && inThis(byId.get(id)!));
        const items = pinnedFirst(pins, products.filter(inThis)).slice(0, rail.limit);
        if (items.length > 0) {
          out.push({ key: `${rail.id}:${category.id}`, title: category.name, href: `/browse?category=${category.slug}`, items });
        }
      }
      continue;
    }
    let items: Product[] = [];
    let title = rail.title;
    let href: string | undefined;
    if (rail.kind === "featured") items = products.filter((p) => p.featured);
    else if (rail.kind === "new") {
      items = products;
      href = "/browse?sort=new";
    } else if (rail.kind === "category") {
      const category = rail.categoryId ? catById.get(rail.categoryId) : undefined;
      if (!category) continue;
      items = products.filter((p) => inCategory(p, category.id));
      title = title || category.name;
      href = `/browse?category=${category.slug}`;
    }
    items = pinnedFirst(rail.productIds, rail.kind === "custom" ? [] : items);
    items = items.slice(0, rail.limit);
    if (items.length > 0) out.push({ key: rail.id, title, href, items });
  }
  return out;
}
