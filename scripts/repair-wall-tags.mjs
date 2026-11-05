#!/usr/bin/env node
// Puts a production wall's tags back from dev, after the product form split them.
// Changes only the tags of that one wall, and saves the old ones first.
//   node scripts/repair-wall-tags.mjs pushpa-swag-wall-setup
import { readFileSync, writeFileSync } from "node:fs";

const slug = process.argv[2];
if (!slug) throw new Error("Give the wall's slug");
const env = (file) => Object.fromEntries(readFileSync(file, "utf8").split("\n").flatMap((l) => (/^[A-Z_]+=/.test(l) ? [[l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]] : [])));
const dev = env("apps/web/.env.local");
const prod = env("apps/web/.env.prod");
const url = (e) => e.SUPABASE_URL ?? e.NEXT_PUBLIC_SUPABASE_URL;
const headers = (e) => ({ apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" });
const read = async (e) => (await (await fetch(`${url(e)}/rest/v1/products?select=id,tags,pack_items&slug=eq.${slug}`, { headers: headers(e) })).json())[0];

const [source, target] = [await read(dev), await read(prod)];
if (!source || !target) throw new Error("Wall not found on dev or production");
const spots = source.tags.find((t) => t.startsWith("wall spots:"))?.slice(11).split(";") ?? [];
if (spots.length !== target.pack_items.length) throw new Error("Dev's layout doesn't match this wall");
writeFileSync(`prod_stickers/wall-setups/${slug}-tags-before-repair.json`, JSON.stringify(target, null, 1));
const res = await fetch(`${url(prod)}/rest/v1/products?id=eq.${target.id}`, { method: "PATCH", headers: { ...headers(prod), Prefer: "return=minimal" }, body: JSON.stringify({ tags: source.tags }) });
if (!res.ok) throw new Error(`Save failed: ${res.status} ${await res.text()}`);
console.log(`${slug}: tags restored, posters unchanged.`);
