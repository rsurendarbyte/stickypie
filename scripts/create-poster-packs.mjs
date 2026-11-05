// Creates / updates the mini poster packs listed in prod_stickers/poster-packs/packs.json
// as "poster pack" products: a 2:3 cover picture of the posters laid out on a
// wall, the posters themselves in wall order (pack_items), and one price per
// poster size. Every poster must already be a 2:3 mini poster in that database.
//
//   node scripts/create-poster-packs.mjs            → dev database
//   node scripts/create-poster-packs.mjs --prod     → production database
//   add --dry to check the packs without changing anything,
//   --prices to also reset the prices of packs already made,
//   or --covers to only draw the cover pictures into prod_stickers/poster-packs/covers/
//   --only=red-line,riders to run just those packs
//
// Running it again updates the packs in place (matched by slug) with a new cover.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const IMAGE_HOST = "https://stickers.stickypie.in"; // custom domain of the R2 bucket, as on every product
const PACKS = path.join(root, "prod_stickers/poster-packs/packs.json");
const CATEGORY = { name: "Wall Poster Sets", slug: "poster-packs", sort: 1 };
const CORNER = 0.0327; // corner radius as a share of width, like the poster masters
const RENDITIONS = [
  { column: "thumb_url", maxPx: 480, quality: 80, prefix: "thumbs" },
  { column: "display_url", maxPx: 1024, quality: 82, prefix: "display" },
];
/** One price per pack (by number of posters): [price, compare-at]. Change in the admin any time. */
const PRICES = {
  4: [199, 299],
  6: [199, 449],
  9: [279, 549],
  20: [459, 1199],
};

const { url, key, args } = loadTargetEnv();
const dry = args.includes("--dry");
/** --covers: only draw the cover pictures into prod_stickers/poster-packs/covers/ (nothing uploaded or saved). */
const coversOnly = args.includes("--covers");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function rest(query, init = {}) {
  const res = await fetch(`${url}/rest/v1/${query}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${query.split("?")[0]} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

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

async function put(objectKey, body, contentType) {
  await r2.send(
    new PutObjectCommand({
      Bucket: admin.R2_BUCKET,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${IMAGE_HOST}/${objectKey}`;
}

function rounded(width, height, r) {
  return Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
}

/**
 * Collage layouts on a 3 × 4.5 board (2:3, the same shape as every poster):
 * [x, y, w, h] per poster in pack order, each tile itself 2:3. The big tiles are
 * the posters printed 6 × 9 in, the rest are 4 × 6 in.
 */
const grid = (cols) =>
  Array.from({ length: cols * cols }, (_, i) => [(i % cols) * (3 / cols), Math.floor(i / cols) * (4.5 / cols), 3 / cols, 4.5 / cols]);
const LAYOUTS = {
  4: grid(2),
  9: grid(3),
  // one big poster, two small beside it, three small below
  6: [[0, 0, 2, 3], [2, 0, 1, 1.5], [2, 1.5, 1, 1.5], [0, 3, 1, 1.5], [1, 3, 1, 1.5], [2, 3, 1, 1.5]],
  // two big posters on the diagonal, nine small in each of the other corners
  20: [
    [0, 0, 1.5, 2.25],
    ...Array.from({ length: 9 }, (_, i) => [1.5 + (i % 3) * 0.5, Math.floor(i / 3) * 0.75, 0.5, 0.75]),
    ...Array.from({ length: 9 }, (_, i) => [(i % 3) * 0.5, 2.25 + Math.floor(i / 3) * 0.75, 0.5, 0.75]),
    [1.5, 2.25, 1.5, 2.25],
  ],
};
/** Each poster's printed size (longest side, inches) by its tile: the biggest tiles in a mixed layout are 6 × 9 in. */
function packSizes(count) {
  const layout = LAYOUTS[count] ?? grid(Math.ceil(Math.sqrt(count)));
  const widths = layout.slice(0, count).map((l) => l[2]);
  const mixed = Math.max(...widths) > Math.min(...widths);
  return widths.map((w) => (mixed && w === Math.max(...widths) ? 9 : 6));
}
const COVER_W = 1200;
const COVER_H = 1800;
const COVER_GAP = 10; // px between posters
const COVER_BG = "#f4f1ec";

/**
 * The pack's cover: a 2:3 collage filled edge to edge with all its posters
 * (layout by pack size, see LAYOUTS), rounded like the posters.
 */
async function cover(pack, posters) {
  const layout = LAYOUTS[posters.length] ?? grid(Math.ceil(Math.sqrt(posters.length)));
  const k = COVER_W / 3;
  const half = COVER_GAP / 2;
  const layers = [];
  for (const [i, p] of posters.entries()) {
    const [x, y, w, h] = layout[i];
    const left = Math.round(x * k + half);
    const top = Math.round(y * k + half);
    const tw = Math.round((x + w) * k - half) - left;
    const th = Math.round((y + h) * k - half) - top;
    const src = Buffer.from(await (await fetch(p.image_url)).arrayBuffer());
    const tile = await sharp(src)
      .resize(tw, th, { fit: "cover" })
      .ensureAlpha()
      .composite([{ input: rounded(tw, th, Math.max(4, Math.round(tw * CORNER))), blend: "dest-in" }])
      .png()
      .toBuffer();
    layers.push({ input: tile, left, top });
  }
  const png = await sharp({ create: { width: COVER_W, height: COVER_H, channels: 4, background: COVER_BG } })
    .composite(layers)
    .png()
    .toBuffer();
  // Round the corners on the flattened picture (a mask in the same composite would clip only itself).
  const out = await sharp(png)
    .composite([{ input: rounded(COVER_W, COVER_H, Math.round(COVER_W * CORNER)), blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png: out, ratio: 0.6667 };
}

// --only=id1,id2 limits the run to those packs (the others stay as they are).
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const packs = JSON.parse(fs.readFileSync(PACKS, "utf8")).filter((p) => !only || only.includes(p.id));

let [category] = await rest(`categories?slug=eq.${CATEGORY.slug}&select=id`);
if (!category && !dry) [category] = await rest("categories", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(CATEGORY) });

let ok = 0;
for (const pack of packs) {
  try {
    const slugs = pack.items.map((s) => `${s}-mini-poster`);
    const found = await rest(`products?slug=in.(${slugs.join(",")})&select=id,slug,name,image_url,display_url,aspect_ratio`);
    const posters = slugs.map((s) => found.find((p) => p.slug === s));
    const missing = slugs.filter((_, i) => !posters[i]);
    if (missing.length) throw new Error(`missing posters: ${missing.join(", ")}`);
    const notTall = posters.filter((p) => Math.abs(Number(p.aspect_ratio) - 2 / 3) > 0.01);
    if (notTall.length) throw new Error(`not 2:3 yet: ${notTall.map((p) => p.slug).join(", ")}`);
    const prices = PRICES[posters.length];
    if (!prices) throw new Error(`no prices set for a pack of ${posters.length}`);

    const slug = `${pack.id}-poster-pack`;
    const sizesOf = packSizes(posters.length);
    const big = sizesOf.filter((s) => s === 9).length;
    const sizeText = big ? `${big} big 6 × 9 in and ${posters.length - big} at 4 × 6 in` : "each 4 × 6 in";
    const row = {
      slug,
      name: `${pack.name} — ${posters.length} Mini Poster Pack`,
      description: `${pack.blurb} ${posters.length} mini posters (${sizeText}) — lay them out like the picture for an instant wall collage.`,
      // one price for the whole pack: no size to pick
      price: prices[0],
      compare_at_price: prices[1],
      sizes: [],
      aspect_ratio: null, // the cover's shape, set below
      // Only in Poster Packs: a pack is a set, not one mini poster.
      category_ids: [category?.id].filter(Boolean),
      category_id: category?.id ?? null,
      pack_items: posters.map((p) => p.id),
      pack_sizes: sizesOf,
      tags: ["poster pack", "wall collage", ...pack.tags],
      is_active: true,
      is_new: true,
      featured: false,
      stock: null,
    };
    if (coversOnly) {
      const dir = path.join(root, "prod_stickers/poster-packs/covers");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${pack.id}.png`), (await cover(pack, posters)).png);
      console.log(`  ✓ ${pack.id} cover saved`);
      ok++;
      continue;
    }
    if (dry) {
      console.log(`  ✓ ${row.name}: ₹${row.price} (${sizeText})`);
      ok++;
      continue;
    }

    const { png, ratio } = await cover(pack, posters);
    row.aspect_ratio = ratio;
    const ts = Date.now();
    row.image_url = await put(`packs/${slug}-${ts}.png`, png, "image/png");
    for (const { column, maxPx, quality, prefix } of RENDITIONS) {
      const webp = await sharp(png).resize(maxPx, maxPx, { fit: "inside" }).webp({ quality, alphaQuality: 90 }).toBuffer();
      row[column] = await put(`${prefix}/${slug}-${maxPx}-${ts}.webp`, webp, "image/webp");
    }
    const [existing] = await rest(`products?slug=eq.${slug}&select=id`);
    if (existing) {
      // An edit keeps whatever was changed by hand in the admin since (price, open for sale…);
      // --prices also resets the price.
      const { sizes: _s, price: _p, compare_at_price: _c, is_active: _a, is_new: _n, featured: _f, stock: _st, ...keep } = row;
      const patch = args.includes("--prices") ? { ...keep, sizes: row.sizes, price: row.price, compare_at_price: row.compare_at_price } : keep;
      await rest(`products?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    } else {
      await rest("products", { method: "POST", body: JSON.stringify(row) });
    }
    ok++;
    console.log(`  ✔ ${row.name} ${existing ? "(updated)" : "(new)"}`);
  } catch (err) {
    console.log(`  ✘ ${pack.id}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`${dry ? "Checked" : "Saved"} ${ok}/${packs.length} poster packs.`);
