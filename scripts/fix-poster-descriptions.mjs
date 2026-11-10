// Mini posters and wall sets are paper, but most of their descriptions still end
// "— a mini poster for your car, bike, laptop, bottle, fridge or wall." (from
// when posters were also sold as stickers). This rewrites just that ending to
// "— a mini poster on premium poster paper, for your wall." Stickers are never
// touched (for them "car, bike, laptop" is right). Old descriptions are saved
// first.
//
//   node scripts/fix-poster-descriptions.mjs              → dev, only lists changes
//   node scripts/fix-poster-descriptions.mjs --apply      → dev, writes them
//   node scripts/fix-poster-descriptions.mjs --prod [--apply]
import fs from "node:fs";
import path from "node:path";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const { url, key, prod } = loadTargetEnv();
const apply = process.argv.includes("--apply");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// same rule as apps/web/src/lib/poster.ts isPoster()
const isPoster = (p) =>
  p.slug.endsWith("-mini-poster") ||
  (p.tags ?? []).some((t) => t.toLowerCase() === "mini poster") ||
  (p.pack_items ?? []).length > 0;

// "for your car, bike, laptop, bottle, fridge or wall" and its shorter variants
const PLACES = /for your car, bike, laptop(?:, [a-z]+)*,? or [a-z]+/i;

function rewrite(description) {
  if (!PLACES.test(description)) return null;
  let next = description.replace(PLACES, "for your wall");
  // keeps the capital when it starts a sentence ("…fireworks. A mini poster…")
  if (!/poster paper/i.test(next)) next = next.replace(/(a) mini poster for your wall/i, "$1 mini poster on premium poster paper, for your wall");
  return next === description ? null : next;
}

const res = await fetch(`${url}/rest/v1/products?select=id,slug,name,description,tags,pack_items&limit=2000`, { headers });
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const rows = await res.json();
const changes = rows
  .filter(isPoster)
  .map((p) => ({ id: p.id, slug: p.slug, before: p.description ?? "", after: rewrite(p.description ?? "") }))
  .filter((c) => c.after);

const skippedStickers = rows.filter((p) => !isPoster(p) && PLACES.test(p.description ?? "")).length;
console.log(`${prod ? "PRODUCTION" : "dev"}: ${changes.length} poster descriptions to fix (${skippedStickers} stickers say it too and stay as they are)`);
for (const c of changes.slice(0, 5)) console.log(`\n${c.slug}\n  - ${c.before}\n  + ${c.after}`);
if (changes.length > 5) console.log(`\n…and ${changes.length - 5} more`);

if (!apply) {
  console.log("\nNothing written (add --apply to write).");
  process.exit(0);
}

const backupDir = path.join(root, "prod_stickers/description-backups");
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `${prod ? "prod" : "dev"}-poster-descriptions-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(backup, JSON.stringify(changes.map(({ id, slug, before }) => ({ id, slug, description: before })), null, 2));
console.log(`\nOld descriptions saved to ${path.relative(root, backup)}`);

let done = 0;
for (const c of changes) {
  const r = await fetch(`${url}/rest/v1/products?id=eq.${c.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ description: c.after }),
  });
  if (!r.ok) throw new Error(`${c.slug}: ${r.status} ${await r.text()} (${done} done before this)`);
  done++;
}
console.log(`✔ ${done} descriptions updated on ${prod ? "PRODUCTION" : "dev"}.`);
