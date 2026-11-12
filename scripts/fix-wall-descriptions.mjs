#!/usr/bin/env node
// Rewrites the template description of wall sets ("A ready wall setup of 6
// posters…") as one written from the wall's own posters (lib/wall-description.mjs).
// Hand-written descriptions (the calendar walls) are left alone.
//   node scripts/fix-wall-descriptions.mjs            dev, shows what would change
//   node scripts/fix-wall-descriptions.mjs --save     dev, saves
//   node scripts/fix-wall-descriptions.mjs --prod --save
import { loadTargetEnv } from "./lib/target-env.mjs";
import { wallDescription, wallTagFacts } from "./lib/wall-description.mjs";

const { url, key, args } = loadTargetEnv();
const save = args.includes("--save");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = async (query, init = {}) => {
  const res = await fetch(`${url}/rest/v1/${query}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const walls = (await rest("products?select=id,slug,name,description,tags,pack_items&tags=cs.{\"wall setup\"}&limit=1000")).filter((w) =>
  w.description.startsWith("A ready wall setup of")
);
const ids = [...new Set(walls.flatMap((w) => w.pack_items))];
const names = new Map();
for (let i = 0; i < ids.length; i += 150) {
  for (const p of await rest(`products?select=id,name&id=in.(${ids.slice(i, i + 150).join(",")})`)) names.set(p.id, p.name);
}

let changed = 0;
for (const wall of walls) {
  const posterNames = wall.pack_items.map((id) => names.get(id)).filter(Boolean);
  if (posterNames.length !== wall.pack_items.length) {
    console.log(`${wall.slug}: ${wall.pack_items.length - posterNames.length} poster(s) missing, skipped`);
    continue;
  }
  const description = wallDescription({ name: wall.name, posterNames, ...wallTagFacts(wall.tags) });
  if (!save) {
    if (changed < 5) console.log(`${wall.slug}\n  ${description}\n`);
  } else {
    await rest(`products?id=eq.${wall.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ description }) });
  }
  changed++;
}
console.log(`${changed} wall(s) ${save ? "updated" : "to update (run with --save)"}`);
