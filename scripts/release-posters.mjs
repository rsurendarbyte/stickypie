#!/usr/bin/env node
// Puts new 2:3 mini posters on sale from a folder holding posters.json and the art.
// Rounds the corners, uploads one PNG master, then adds the products. Dev first,
// then production reuses the same picture. Skips a slug that already exists.
//   node scripts/release-posters.mjs <folder>          dev
//   node scripts/release-posters.mjs <folder> --prod   production
// Then: npm run thumbs:build   (and npm run thumbs:build -- --prod)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("apps/admin/package.json"));
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const sharp = createRequire(path.resolve("package.json"))("sharp");

const folder = process.argv[2];
const prod = process.argv.includes("--prod");
if (!folder) throw new Error("Give the release folder");
const env = (file) =>
  Object.fromEntries(readFileSync(file, "utf8").split("\n").flatMap((l) => (/^[A-Z0-9_]+=/.test(l) ? [[l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]] : [])));
const db = env(prod ? "apps/web/.env.prod" : "apps/web/.env.local");
const r2 = env("apps/admin/.env.local");
const base = db.SUPABASE_URL ?? db.NEXT_PUBLIC_SUPABASE_URL;
const headers = { apikey: db.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${db.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const rest = async (query, init) => {
  const res = await fetch(`${base}/rest/v1/${query}`, { headers, ...init });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const IMAGE_HOST = "https://stickers.stickypie.in";
const uploaded = path.join(folder, "uploaded.json");
const urls = existsSync(uploaded) ? JSON.parse(readFileSync(uploaded, "utf8")) : {};
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${r2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2.R2_ACCESS_KEY_ID, secretAccessKey: r2.R2_SECRET_ACCESS_KEY },
});

async function master(item) {
  if (urls[item.slug]) return urls[item.slug];
  const art = sharp(path.join(folder, item.file));
  const { width, height } = await art.metadata();
  const radius = Math.round(width * 0.03);
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`);
  const body = await art.ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const key = `${item.slug}-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({ Bucket: r2.R2_BUCKET, Key: key, Body: body, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));
  urls[item.slug] = `${IMAGE_HOST}/${key}`;
  writeFileSync(uploaded, JSON.stringify(urls, null, 1));
  return urls[item.slug];
}

const categories = await rest("categories?select=id,slug&limit=200");
for (const item of JSON.parse(readFileSync(path.join(folder, "posters.json"), "utf8"))) {
  if ((await rest(`products?select=id&slug=eq.${item.slug}`)).length) {
    console.log(`${item.slug}: already there, skipped`);
    continue;
  }
  const category_ids = item.categories.map((slug) => {
    const found = categories.find((c) => c.slug === slug);
    if (!found) throw new Error(`No category ${slug}`);
    return found.id;
  });
  await rest("products", {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      slug: item.slug,
      name: item.name,
      description: item.description,
      price: 60,
      compare_at_price: 150,
      sizes: [
        { inches: 6, price: 60, compare_at_price: 150 },
        { inches: 9, price: 120, compare_at_price: 350 },
      ],
      category_id: category_ids[0],
      category_ids,
      image_url: await master(item),
      tags: item.tags,
      aspect_ratio: 0.6667,
      is_new: true,
      featured: false,
      is_active: true,
      stock: null,
    }),
  });
  console.log(`${item.slug}: added to ${prod ? "production" : "dev"}`);
}
