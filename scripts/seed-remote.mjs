// Seeds the demo catalog into a Supabase project over the REST API.
// Idempotent: existing slugs are left untouched (safe to re-run; it will
// never clobber products you've edited in the admin).
//
//   node scripts/seed-remote.mjs
//
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment, falling
// back to apps/web/.env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(root, "apps/web/.env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const env = loadEnv();
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
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
