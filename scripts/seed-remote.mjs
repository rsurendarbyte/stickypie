// Seeds the demo catalog into a Supabase project over the REST API.
// Idempotent: existing slugs are left untouched (safe to re-run; it will
// never clobber products you've edited in the admin).
//
//   npm run seed:remote        (dev database only)
//
// Production is deliberately unseeded — its catalog is entered from the
// admin app — so this refuses to run with --prod.
import fs from "node:fs";
import path from "node:path";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const { prod, url: URL_, key: KEY } = loadTargetEnv();
if (prod) {
  console.error("Refusing to seed demo data into PRODUCTION. Add products from the admin app.");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathname, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const seed = JSON.parse(
  fs.readFileSync(path.join(root, "packages/shared/src/seed-data.json"), "utf8")
);

// 1. Categories (skip ones that already exist)
await rest("categories?on_conflict=slug", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates" },
  body: JSON.stringify(seed.categories.map(({ name, slug, sort }) => ({ name, slug, sort }))),
});
const categories = await rest("categories?select=id,slug");
const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
console.log(`categories: ${categories.length} in database`);

// 2. Products (skip existing slugs so admin edits are never overwritten)
const DAY_MS = 86_400_000;
const now = Date.now();
const rows = seed.products.map((p, i) => ({
  slug: p.slug,
  name: p.name,
  description: p.description,
  price: p.price,
  compare_at_price: p.compareAtPrice,
  category_id: idBySlug.get(p.category) ?? null,
  image_url: p.image,
  tags: p.tags,
  featured: p.featured,
  is_active: p.isActive,
  stock: p.stock,
  created_at: new Date(now - i * 2 * DAY_MS).toISOString(),
}));
const inserted = await rest("products?on_conflict=slug&select=slug", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
  body: JSON.stringify(rows),
});
const total = await rest("products?select=id");
console.log(`products: inserted ${inserted?.length ?? 0} new, ${total.length} total in database`);
console.log("Seed complete.");
