// Takes the same share off every wall set: ₹199 → ₹145 (about 27% off), so 229 → 167,
// 299 → 218, 549 → 399 and so on. Crossed-out prices, single posters and stickers stay
// as they are. Prices before the change are saved first.
//
//   node scripts/wall-price-cut.mjs            → dev database
//   node scripts/wall-price-cut.mjs --prod     → production database
//   add --dry to only list the new prices
import fs from "node:fs";
import { loadTargetEnv } from "./lib/target-env.mjs";

const RATIO = 145 / 199;
// Hand-picked ends where the share lands on a round number.
const PICKED = { 400: 399 };
const cut = (price) => { const p = Math.round(price * RATIO); return PICKED[p] ?? p; };

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
const prod = process.argv.includes("--prod");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(
  `${url}/rest/v1/products?select=id,slug,name,is_active,price,compare_at_price,sizes,pack_items&pack_items=not.eq.%7B%7D&limit=1000`,
  { headers },
);
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const live = (await res.json()).filter((p) => p.pack_items?.length);

// A run that stopped halfway is picked up again from the saved old prices,
// so no set is cut twice.
const backup = `prod_stickers/wall-setups/${prod ? "prod" : "dev"}-wall-prices-before-145-cut.json`;
const saved = fs.existsSync(backup) ? new Map(JSON.parse(fs.readFileSync(backup, "utf8")).map((w) => [w.id, w])) : null;
if (saved) console.log(`Old prices taken from ${backup}`);
const walls = live.map((w) => saved?.get(w.id) ?? w);

const ladder = new Map();
for (const w of walls) ladder.set(w.price, cut(w.price));
console.log("Old → new:");
for (const [from, to] of [...ladder].sort((a, b) => a[0] - b[0])) {
  console.log(`  ₹${from} → ₹${to}  (${walls.filter((w) => w.price === from).length} sets)`);
}

const liveById = new Map(live.map((w) => [w.id, w]));
const left = walls.filter((w) => liveById.get(w.id).price !== ladder.get(w.price));
console.log(`${walls.length - left.length} of ${walls.length} sets already on the new price.`);

if (!dry && !saved) {
  fs.writeFileSync(backup, JSON.stringify(walls, null, 1));
  console.log(`Saved old prices to ${backup}`);
}

let changed = 0;
for (const w of left) {
  if (dry) continue;
  const price = ladder.get(w.price);
  const sizes = (w.sizes ?? []).map((s) => ({ ...s, price: cut(s.price) }));
  const r = await patch(w.id, { price, sizes });
  if (r.ok) changed++;
  else console.log(`  ✘ ${w.slug}: ${r.status} ${await r.text()}`);
}
console.log(`${dry ? "Would change" : "Changed"} ${dry ? left.length : changed} of ${left.length} remaining wall sets (hidden ones included).`);

async function patch(id, body) {
  for (let tries = 1; ; tries++) {
    try {
      return await fetch(`${url}/rest/v1/products?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
    } catch (err) {
      if (tries === 6) throw err;
      await new Promise((ok) => setTimeout(ok, 3000 * tries));
    }
  }
}
