// Puts brand-new mini posters on sale: for each entry in a list it takes the
// picture from prod_stickers/2x3-ai/<slug>.(png|jpg|webp), rounds the corners like
// the other posters, uploads the master + thumb + display renditions to R2, and
// adds the product. Slugs already in the shop are skipped, so admin edits stay.
//
//   node scripts/add-mini-posters.mjs <list.json>          → dev database
//   node scripts/add-mini-posters.mjs --prod <list.json>   → production database
//   add --dry to check the files without uploading anything
//
// A list entry: { slug, name, about, cats: [category slugs], tags: [] }.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const IMAGE_HOST = "https://stickers.stickypie.in";
const RESULTS = path.join(root, "prod_stickers/2x3-ai");
const CORNER = 0.0327; // corner radius as a share of width, measured on the existing masters
const RENDITIONS = [
  { column: "tiny_url", maxPx: 240, quality: 72, prefix: "tiny" },
  { column: "thumb_url", maxPx: 480, quality: 80, prefix: "thumbs" },
  { column: "display_url", maxPx: 1024, quality: 82, prefix: "display" },
];
const SIZES = [
  { inches: 6, price: 60, compare_at_price: 150 },
  { inches: 9, price: 120, compare_at_price: 350 },
];
const USES = ["wall", "poster", "wall poster", "mini poster", "room decor"];

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
const listFile = args.find((a) => !a.startsWith("--"));
if (!listFile) {
  console.error("Give the list file.");
  process.exit(1);
}
const list = JSON.parse(fs.readFileSync(path.resolve(root, listFile), "utf8"));

const admin = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "apps/admin/.env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${admin.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: admin.R2_ACCESS_KEY_ID, secretAccessKey: admin.R2_SECRET_ACCESS_KEY },
});
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function put(objectKey, body, contentType) {
  await r2.send(
    new PutObjectCommand({ Bucket: admin.R2_BUCKET, Key: objectKey, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" })
  );
  return `${IMAGE_HOST}/${objectKey}`;
}

async function master(file) {
  const img = sharp(file).ensureAlpha();
  const { width, height } = await img.metadata();
  if (Math.abs(width / height - 2 / 3) > 0.01) throw new Error(`not 2:3 (${width}×${height})`);
  const r = Math.round(width * CORNER);
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  return { png: await img.composite([{ input: mask, blend: "dest-in" }]).png({ compressionLevel: 9 }).toBuffer(), width, height };
}

const categories = await (await fetch(`${url}/rest/v1/categories?select=id,slug`, { headers })).json();
const categoryId = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

let ok = 0;
for (const entry of list) {
  try {
    const name = fs.readdirSync(RESULTS).find((f) => f.replace(/\.(png|jpg|jpeg|webp)$/, "") === entry.slug);
    if (!name) throw new Error("no image in prod_stickers/2x3-ai");
    const ids = ["mini-posters", ...entry.cats].map((slug) => {
      if (!categoryId[slug]) throw new Error(`no category ${slug}`);
      return categoryId[slug];
    });
    const [found] = await (await fetch(`${url}/rest/v1/products?slug=eq.${entry.slug}&select=id`, { headers })).json();
    if (found) {
      console.log(`  – ${entry.slug}: already in the shop`);
      continue;
    }
    const { png, width, height } = await master(path.join(RESULTS, name));
    if (dry) {
      console.log(`  ✓ ${entry.name}: ${width}×${height}, ready`);
      ok++;
      continue;
    }
    const ts = Date.now();
    const row = {
      slug: entry.slug,
      name: `${entry.name} — Mini Poster`,
      description: `${entry.about} — a mini poster on premium poster paper, for your wall.`,
      price: SIZES[0].price,
      compare_at_price: SIZES[0].compare_at_price,
      sizes: SIZES,
      category_id: ids[0],
      category_ids: ids,
      tags: [...new Set([...entry.tags, ...USES])],
      aspect_ratio: +(width / height).toFixed(4),
      is_active: true,
      is_new: true,
      featured: false,
      stock: null,
      image_url: await put(`${entry.slug}-${ts}.png`, png, "image/png"),
    };
    for (const { column, maxPx, quality, prefix } of RENDITIONS) {
      const webp = await sharp(png).resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 90 }).toBuffer();
      row[column] = await put(`${prefix}/${entry.slug}-${maxPx}-${ts}.webp`, webp, "image/webp");
    }
    const res = await fetch(`${url}/rest/v1/products`, { method: "POST", headers, body: JSON.stringify(row) });
    if (!res.ok) throw new Error(`save failed ${res.status} ${await res.text()}`);
    ok++;
    console.log(`  ✔ ${row.name}`);
  } catch (err) {
    console.log(`  ✘ ${entry.slug}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`${dry ? "Checked" : "Added"} ${ok}/${list.length}.`);
