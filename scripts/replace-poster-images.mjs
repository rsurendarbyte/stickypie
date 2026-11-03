// Puts redrawn 2:3 mini posters live: for each slug it takes the new image from
// prod_stickers/2x3-ai/<slug>.(png|jpg|webp), rounds the corners like the other
// poster masters, uploads the master + thumb + display renditions to R2 under NEW
// keys (the old files stay, so past orders keep their picture), then points the
// product at them and sets aspect_ratio.
//
//   node scripts/replace-poster-images.mjs <slug>...          → dev database
//   node scripts/replace-poster-images.mjs --prod <slug>...   → production database
//   add --dry to check the files without uploading anything
//
// Every change is appended to prod_stickers/2x3-ai/replaced-log.json with the
// old URLs, so a poster can be switched back.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const IMAGE_HOST = "https://stickers.stickypie.in"; // custom domain of the R2 bucket, as on every product
const RESULTS = path.join(root, "prod_stickers/2x3-ai");
const LOG = path.join(RESULTS, "replaced-log.json");
const CORNER = 0.0327; // corner radius as a share of width, measured on the existing masters
const RENDITIONS = [
  { column: "thumb_url", maxPx: 480, quality: 80, prefix: "thumbs" },
  { column: "display_url", maxPx: 1024, quality: 82, prefix: "display" },
];

const { url, key, prod, args } = loadTargetEnv();
const dry = args.includes("--dry");
const slugs = args.filter((a) => !a.startsWith("--"));
if (!slugs.length) {
  console.error("Give at least one poster slug.");
  process.exit(1);
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
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

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

/** The new image as a PNG master with rounded corners. */
async function master(file) {
  const img = sharp(file).ensureAlpha();
  const { width, height } = await img.metadata();
  const ratio = width / height;
  if (Math.abs(ratio - 2 / 3) > 0.01) throw new Error(`not 2:3 (${width}×${height})`);
  const r = Math.round(width * CORNER);
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
  const png = await img.composite([{ input: mask, blend: "dest-in" }]).png({ compressionLevel: 9 }).toBuffer();
  return { png, width, height };
}

const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")) : [];
let ok = 0;
for (const slug of slugs) {
  try {
    const name = fs.readdirSync(RESULTS).find((f) => f.replace(/\.(png|jpg|jpeg|webp)$/, "") === slug);
    if (!name) throw new Error("no new image in prod_stickers/2x3-ai");
    const [product] = await (
      await fetch(`${url}/rest/v1/products?slug=eq.${slug}&select=id,name,image_url,thumb_url,display_url,aspect_ratio`, { headers })
    ).json();
    if (!product) throw new Error("no product with that slug");

    const { png, width, height } = await master(path.join(RESULTS, name));
    if (dry) {
      console.log(`  ✓ ${product.name}: ${width}×${height}, ready`);
      ok++;
      continue;
    }

    const ts = Date.now();
    const patch = { image_url: await put(`${slug}-${ts}.png`, png, "image/png"), aspect_ratio: +(width / height).toFixed(4) };
    for (const { column, maxPx, quality, prefix } of RENDITIONS) {
      const webp = await sharp(png).resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true }).webp({ quality, alphaQuality: 90 }).toBuffer();
      patch[column] = await put(`${prefix}/${slug}-${maxPx}-${ts}.webp`, webp, "image/webp");
    }
    const res = await fetch(`${url}/rest/v1/products?id=eq.${product.id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    if (!res.ok) throw new Error(`save failed ${res.status} ${await res.text()}`);

    log.push({ at: new Date().toISOString(), db: prod ? "prod" : "dev", slug, old: product, new: patch });
    fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
    ok++;
    console.log(`  ✔ ${product.name} → ${patch.image_url}`);
  } catch (err) {
    console.log(`  ✘ ${slug}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`${dry ? "Checked" : "Replaced"} ${ok}/${slugs.length}.`);
