// Mini posters sell in 4 × 6 and 6 × 9 in only: every other size is dropped and
// the headline price moves to the cheapest size left. Sizes kept keep their prices.
//
//   node scripts/mini-poster-sizes.mjs            → dev database
//   node scripts/mini-poster-sizes.mjs --prod     → production database
//   add --dry to only count them
import { loadTargetEnv } from "./lib/target-env.mjs";

const KEEP = [6, 9];

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(`${url}/rest/v1/products?or=(slug.like.*-mini-poster,tags.cs.%7B%22mini%20poster%22%7D)&select=id,slug,sizes`, { headers });
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const posters = await res.json();

let changed = 0;
const short = [];
for (const p of posters) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const next = sizes.filter((s) => KEEP.includes(Number(s.inches))).sort((a, b) => a.inches - b.inches);
  if (next.length < KEEP.length) short.push(p.slug);
  if (next.length === 0 || next.length === sizes.length) continue;
  const cheapest = [...next].sort((a, b) => a.price - b.price)[0];
  changed++;
  if (dry) continue;
  const r = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sizes: next, price: cheapest.price, compare_at_price: cheapest.compare_at_price ?? null }),
  });
  if (!r.ok) console.log(`  ✘ ${p.slug}: ${r.status} ${await r.text()}`);
}
console.log(`${dry ? "Would change" : "Changed"} ${changed} of ${posters.length} mini posters to 4 × 6 and 6 × 9 in only.`);
if (short.length) console.log(`Missing a 4 × 6 or 6 × 9 size (${short.length}): ${short.join(", ")}`);
