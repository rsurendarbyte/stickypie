// Makes the small WebP card image for every product that doesn't have one yet.
//
//   npm run thumbs:build            → dev database
//   npm run thumbs:build -- --prod  → production database
//
// Uploads to the R2 bucket configured in apps/admin/.env.local (same settings
// as the admin's automatic thumbnails, apps/admin/src/lib/thumbs.ts) and sets
// products.thumb_url. Safe to re-run: products that already have one are skipped.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const THUMB_MAX_PX = 480;
const { url, key } = loadTargetEnv();

const admin = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "apps/admin/.env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) {
  if (!admin[k]) {
    console.error(`Missing ${k} in apps/admin/.env.local`);
    process.exit(1);
  }
}
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${admin.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: admin.R2_ACCESS_KEY_ID, secretAccessKey: admin.R2_SECRET_ACCESS_KEY },
});
const publicUrl = admin.R2_PUBLIC_URL.replace(/\/+$/, "");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

/** Full-size artwork bytes: storefront-bundled images are read from disk. */
async function artwork(imageUrl) {
  if (!/^https?:\/\//.test(imageUrl)) {
    const file = path.join(root, "apps/web/public", imageUrl.replace(/^\/+/, ""));
    return fs.readFileSync(file);
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const products = await (
  await fetch(`${url}/rest/v1/products?select=id,name,image_url,thumb_url&thumb_url=is.null`, { headers })
).json();
console.log(`${products.length} product(s) need a thumbnail`);

let done = 0;
for (const p of products) {
  try {
    const source = await artwork(p.image_url);
    const webp = await sharp(source)
      .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, alphaQuality: 90 })
      .toBuffer();
    const base = (p.image_url.split("/").pop() ?? "sticker").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-");
    const objectKey = `thumbs/${base}-${THUMB_MAX_PX}-${Date.now()}.webp`;
    await r2.send(
      new PutObjectCommand({
        Bucket: admin.R2_BUCKET,
        Key: objectKey,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const res = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ thumb_url: `${publicUrl}/${objectKey}` }),
    });
    if (!res.ok) throw new Error(`save failed ${res.status}`);
    done++;
    console.log(`  ✔ ${p.name}  ${Math.round(source.length / 1024)} KB → ${Math.round(webp.length / 1024)} KB`);
  } catch (err) {
    console.log(`  ✘ ${p.name}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`✔ ${done}/${products.length} thumbnails made.`);
