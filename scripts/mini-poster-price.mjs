// Sets the single mini poster prices: 4 × 6 in ₹60, 6 × 9 in ₹120. Crossed-out prices
// and wall sets stay as they are. Prices before the change are saved first.
//
//   node scripts/mini-poster-price.mjs            → dev database
//   node scripts/mini-poster-price.mjs --prod     → production database
//   add --dry to only count them
import fs from "node:fs";
import { loadTargetEnv } from "./lib/target-env.mjs";

const PRICES = { 6: 60, 9: 120 };

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
const prod = process.argv.includes("--prod");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(
  `${url}/rest/v1/products?or=(slug.like.*-mini-poster,tags.cs.%7B%22mini%20poster%22%7D)&select=id,slug,is_active,price,compare_at_price,sizes,pack_items&limit=1000`,
  { headers },
);
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const rows = await res.json();
const posters = rows.filter((p) => !p.pack_items?.length);

const odd = posters.filter((p) => JSON.stringify((p.sizes ?? []).map((s) => [s.inches, s.price])) !== "[[6,80],[9,199]]");
if (odd.length) console.log(`Left alone, not on the usual sizes and prices: ${odd.map((p) => p.slug).join(", ")}`);
const list = posters.filter((p) => !odd.includes(p));

if (!dry) {
  const backup = `prod_stickers/wall-setups/${prod ? "prod" : "dev"}-poster-prices-before-60-120.json`;
  fs.writeFileSync(backup, JSON.stringify(list, null, 1));
  console.log(`Saved old prices to ${backup}`);
}

let changed = 0;
for (const p of list) {
  if (dry) continue;
  const sizes = p.sizes.map((s) => ({ ...s, price: PRICES[s.inches] }));
  const r = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, { method: "PATCH", headers, body: JSON.stringify({ price: PRICES[6], sizes }) });
  if (r.ok) changed++;
  else console.log(`  ✘ ${p.slug}: ${r.status} ${await r.text()}`);
}
console.log(`${dry ? "Would change" : "Changed"} ${dry ? list.length : changed} of ${posters.length} mini posters (hidden ones included), ${rows.length - posters.length} wall sets skipped.`);
