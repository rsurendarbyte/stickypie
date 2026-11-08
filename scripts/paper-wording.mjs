#!/usr/bin/env node
// Paper wording without GSM: rewrites "270 GSM" / "300 GSM" in saved text (product descriptions and every
// other product text field, and the home page settings). Lists what it would change
// unless --save is given. Dev database by default, --prod for prod.
import { readFileSync } from "node:fs";

const prod = process.argv.includes("--prod");
const save = process.argv.includes("--save");
const env = Object.fromEntries(
  readFileSync(new URL(`../apps/web/.env.${prod ? "prod" : "local"}`, import.meta.url), "utf8")
    .split("\n")
    .flatMap((line) => (/^[A-Z_]+=/.test(line) ? [[line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]] : []))
);
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const rewrite = (text) =>
  text
    .replace(/\b(270|300) GSM (glossy )?(photo |poster )?paper/g, "premium poster paper")
    .replace(/(^|[".] ?)premium poster paper/g, (_, p) => `${p}Premium poster paper`)
    .replace(/\b(270|300) GSM wall posters/g, "premium wall posters")
    .replace(/\b(270|300) GSM posters/g, "premium posters")
    .replace(/\b(270|300) GSM poster/g, "wall poster")
    .replace(/\b(270|300) GSM,? ?/g, "");
const has = (text) => /\b(270|300) GSM/.test(text);

async function api(path, init) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers, ...init });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const products = [];
for (let from = 0; ; from += 1000) {
  const page = await api(`products?select=*&order=id&limit=1000&offset=${from}`);
  products.push(...page);
  if (page.length < 1000) break;
}

let changed = 0;
for (const product of products) {
  const patch = Object.fromEntries(Object.entries(product).flatMap(([k, v]) => (typeof v === "string" && has(v) ? [[k, rewrite(v)]] : [])));
  if (!Object.keys(patch).length) continue;
  changed += 1;
  console.log(`${product.slug}: ${Object.keys(patch).join(", ")}`);
  if (save) await api(`products?id=eq.${product.id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

const [settings] = await api("store_settings?id=eq.1&select=features");
const features = JSON.stringify(settings.features);
const home = has(features);
if (home) {
  console.log("store_settings: features");
  if (save) await api("store_settings?id=eq.1", { method: "PATCH", body: JSON.stringify({ features: JSON.parse(rewrite(features)) }) });
}

console.log(`${prod ? "prod" : "dev"}: ${changed} of ${products.length} products${home ? " and the home page" : ""} ${save ? "updated" : "would change (add --save)"}`);
