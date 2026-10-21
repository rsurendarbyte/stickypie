// Regenerates supabase/seed.sql from packages/shared/src/seed-data.json so the
// demo catalog is identical in local demo mode and in Supabase.
//
//   node scripts/generate-seed-sql.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(
  fs.readFileSync(path.join(root, "packages/shared/src/seed-data.json"), "utf8")
);

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const num = (n) => (n === null || n === undefined ? "null" : String(n));
const arr = (a) => (a.length ? `array[${a.map(q).join(", ")}]::text[]` : "'{}'::text[]");

let sql = `-- StickyPie demo catalog.
-- Generated from packages/shared/src/seed-data.json (npm run seed:sql) — do not edit by hand.
-- Safe to re-run: existing slugs are skipped.

insert into public.categories (name, slug, sort) values
${seed.categories.map((c) => `  (${q(c.name)}, ${q(c.slug)}, ${c.sort})`).join(",\n")}
on conflict (slug) do nothing;

`;

seed.products.forEach((p, i) => {
  sql += `insert into public.products
  (slug, name, description, price, compare_at_price, category_id, image_url, tags, featured, is_active, stock, created_at)
select ${q(p.slug)}, ${q(p.name)}, ${q(p.description)}, ${p.price}, ${num(p.compareAtPrice)}, c.id,
  ${q(p.image)}, ${arr(p.tags)}, ${p.featured}, ${p.isActive}, ${num(p.stock)},
  now() - interval '${i * 2} days'
from public.categories c where c.slug = ${q(p.category)}
on conflict (slug) do nothing;

`;
});

fs.writeFileSync(path.join(root, "supabase/seed.sql"), sql, "utf8");
console.log(`Wrote supabase/seed.sql (${seed.products.length} products)`);
