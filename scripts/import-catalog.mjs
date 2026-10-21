// Puts a folder of sticker images on sale.
//
//   npm run catalog:import -- prod_stickers --prod
//
// Each image's filename is its product slug; name, description, price,
// category, tags and "featured" come from packages/shared/src/seed-data.json.
// Products are created on sale with stock NOT tracked (never shows sold out)
// and no strike-through price — set real stock and genuine sale prices in the
// admin. The image must already ship with the storefront in
// apps/web/public/stickers/ (served free by Cloudflare); anything else should
// be added through the admin's image upload instead.
//
// Idempotent: existing slugs are skipped, so admin edits are never overwritten.
import fs from "node:fs";
import path from "node:path";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const { args, url: URL_, key: KEY } = loadTargetEnv();
const folder = args[0] ? path.resolve(root, args[0]) : null;
if (!folder || !fs.existsSync(folder)) {
  console.error("Usage: npm run catalog:import -- <image-folder> [--prod]");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function rest(pathname, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "packages/shared/src/seed-data.json"), "utf8")
);
const publicDir = path.join(root, "apps/web/public/stickers");
const slugs = fs
  .readdirSync(folder)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .map((f) => ({ file: f, slug: path.parse(f).name }));

// Validate everything before writing anything.
const problems = [];
const picked = [];
for (const { file, slug } of slugs) {
  const details = catalog.products.find((p) => p.slug === slug);
  if (!details) {
    problems.push(`${file}: no product details for "${slug}" in seed-data.json`);
    continue;
  }
  const shipped = path.join(publicDir, file);
  if (!fs.existsSync(shipped)) {
    problems.push(`${file}: not in apps/web/public/stickers — upload it through the admin instead`);
    continue;
  }
  if (!fs.readFileSync(shipped).equals(fs.readFileSync(path.join(folder, file)))) {
    problems.push(`${file}: differs from apps/web/public/stickers/${file} — copy it there and redeploy first`);
    continue;
  }
  picked.push({ file, details });
}
if (problems.length) {
  console.error("Nothing was imported:\n  " + problems.join("\n  "));
  process.exit(1);
}

// Categories in use (skip ones that already exist).
const usedCategories = catalog.categories.filter((c) =>
  picked.some(({ details }) => details.category === c.slug)
);
await rest("categories?on_conflict=slug", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates" },
  body: JSON.stringify(usedCategories.map(({ name, slug, sort }) => ({ name, slug, sort }))),
});
const categories = await rest("categories?select=id,slug");
const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));

// Keep the catalog's order for "New drops" (first = newest).
const order = new Map(catalog.products.map((p, i) => [p.slug, i]));
const now = Date.now();
const rows = picked.map(({ file, details: p }) => ({
  slug: p.slug,
  name: p.name,
  description: p.description,
  price: p.price,
  compare_at_price: null,
  category_id: idBySlug.get(p.category) ?? null,
  image_url: `/stickers/${file}`,
  tags: p.tags,
  featured: p.featured,
  is_active: true,
  stock: null,
  created_at: new Date(now - (order.get(p.slug) ?? 0) * 60_000).toISOString(),
}));

const inserted = await rest("products?on_conflict=slug&select=slug", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
  body: JSON.stringify(rows),
});
const total = await rest("products?select=id");
console.log(
  `✔ ${inserted?.length ?? 0} new products on sale (${rows.length - (inserted?.length ?? 0)} already existed); ${total.length} products, ${categories.length} categories in the database.`
);
