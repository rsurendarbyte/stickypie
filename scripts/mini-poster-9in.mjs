// Mini posters are 2:3, so 7″ (4.7 × 7 in) is swapped for 9″ (6 × 9 in) on every
// mini poster that sells a 7″ size. Other sizes and prices stay as they are.
//
//   node scripts/mini-poster-9in.mjs            → dev database
//   node scripts/mini-poster-9in.mjs --prod     → production database
//   add --dry to only count them
import { loadTargetEnv } from "./lib/target-env.mjs";

const NINE = { inches: 9, price: 199, compare_at_price: 350 };

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(`${url}/rest/v1/products?or=(slug.like.*-mini-poster,tags.cs.%7B%22mini%20poster%22%7D)&select=id,slug,sizes`, { headers });
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const posters = await res.json();

let changed = 0;
for (const p of posters) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  if (!sizes.some((s) => Number(s.inches) === 7)) continue;
  const next = [...sizes.filter((s) => Number(s.inches) !== 7 && Number(s.inches) !== 9), NINE].sort((a, b) => a.inches - b.inches);
  changed++;
  if (dry) continue;
  const r = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, { method: "PATCH", headers, body: JSON.stringify({ sizes: next }) });
  if (!r.ok) console.log(`  ✘ ${p.slug}: ${r.status} ${await r.text()}`);
}
console.log(`${dry ? "Would change" : "Changed"} ${changed} of ${posters.length} mini posters: 7″ → 9″ (6 × 9 in, ₹${NINE.price}).`);
