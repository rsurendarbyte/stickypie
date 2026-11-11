// What the daily trend-walls run reads before it picks sets: the instructions
// saved in admin → Approve (the "Daily prompt"), today's Google Trends India
// searches, every poster that can go on a wall, and the wall names already used. Claude reads this, picks posters that fit the searches, writes a
// sets file, then runs make-wall-setups --sets=<file> --save --draft.
//
//   node scripts/trend-brief.mjs [--prod] [out.json]     (default prod_stickers/trend-walls/brief.json)
import fs from "node:fs";
import path from "node:path";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const { url, key, args } = loadTargetEnv();
const out = path.resolve(root, args.find((a) => a.endsWith(".json")) ?? "prod_stickers/trend-walls/brief.json");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const get = async (q) => {
  const res = await fetch(`${url}/rest/v1/${q}`, { headers });
  if (!res.ok) throw new Error(`${q.split("?")[0]} → ${res.status} ${await res.text()}`);
  return res.json();
};

const since = new Date(Date.now() - 36 * 3600_000).toISOString();
const [trends, posters, walls, categories, [settings]] = await Promise.all([
  get(`global_trends?select=term,traffic,key_names,names&seen_at=gte.${since}&order=traffic.desc&limit=60`),
  get("products?slug=like.*-mini-poster&is_active=eq.true&select=slug,name,category_ids,tags&limit=1000"),
  get("products?tags=cs.{wall setup}&select=name,is_active,tags&limit=1000"),
  get("categories?select=id,name"),
  get("store_settings?id=eq.1&select=features"),
]);
// the admin's saved prompt, else the default written in the shared package
const defaultPrompt = fs.readFileSync(path.join(root, "packages/shared/src/trend-walls.ts"), "utf8").match(/DEFAULT_TREND_WALLS_PROMPT = `([\s\S]*?)`;/)[1];
const prompt = settings?.features?.trendWalls?.prompt?.trim() || defaultPrompt;
const catName = new Map(categories.map((c) => [c.id, c.name]));
const plainTags = (tags) => (tags ?? []).filter((t) => !/^wall |^trend:|poster pack|mini poster|^(car|bike|laptop|bottle|helmet)$/i.test(t));

const brief = {
  made: new Date().toISOString(),
  // what to make: the owner edits this in admin → Approve
  instructions: prompt,
  // how a set has to be written so the wall script can draw it
  format: [
    "Use only slugs from posters[]. A poster at most once per wall. The first posters listed go big.",
    "Layouts and poster counts that work: centre 6/8/14, trio 7/9/11, side 8/10.",
    "Wall names must be new (not in wallNames) and not end in 'Wall'.",
    "Every set needs tags: [\"trend:<search, max 24 chars>\"]. Theme is one of cars, ride, travel, india, devotional, motivational, retro, festive.",
    "Festival posters out of season are not used.",
  ],
  setShape: { name: "Sky Warriors", theme: "travel", layout: "centre", posters: ["slug-without-mini-poster"], tags: ["trend:air force"] },
  trends: trends.map((t) => ({ term: t.term, traffic: t.traffic, words: [...new Set([...(t.key_names ?? []), ...(t.names ?? []).slice(0, 6)])] })),
  posters: posters
    .filter((p) => !(p.tags ?? []).some((t) => /wall set only/i.test(t)))
    .map((p) => ({
      slug: p.slug.replace(/-mini-poster$/, ""),
      name: p.name.replace(/\s*(—\s*)?Mini Poster\s*$/i, ""),
      cats: (p.category_ids ?? []).map((id) => catName.get(id)).filter(Boolean),
      tags: plainTags(p.tags).slice(0, 8),
    })),
  wallNames: walls.map((w) => w.name.replace(/ Wall Setup.*$| — .*$/, "")),
  waitingForApproval: walls.filter((w) => (w.tags ?? []).includes("awaiting approval")).length,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(brief, null, 1));
console.log(`${brief.trends.length} searches, ${brief.posters.length} posters, ${brief.wallNames.length} walls (${brief.waitingForApproval} waiting) → ${path.relative(root, out)}`);
