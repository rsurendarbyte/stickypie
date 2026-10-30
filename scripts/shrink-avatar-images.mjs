// Shrinks the AI avatar style pictures (admin → Avatar book) that were
// uploaded as full-size PNGs: each becomes a WebP in the R2 bucket and the
// style points at it, so the shop loads KBs instead of MBs.
//   card pictures (covers) → 512px  (cards show them ~200px wide)
//   sample sheets (images) → 1600px (they can be zoomed)
//
//   npm run avatar:shrink                    → dev database
//   npm run avatar:shrink -- --prod          → production database
//   npm run avatar:shrink -- --prod --dry    → only list what would change
//
// Uploads to the R2 bucket configured in apps/admin/.env.local (the admin now
// stores new style pictures this small itself — apps/admin/src/app/api/upload).
// The originals stay in the bucket, and the old style list is saved to
// .avatar-styles-backup-<db>-<time>.json first. Safe to re-run: pictures
// already under 300 KB are left alone.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const SIZES = { covers: 512, images: 1600 };
const QUALITY = 82;
const SMALL_ENOUGH = 300 * 1024;
const dry = process.argv.includes("--dry");
const { url, key, ref } = loadTargetEnv();

const admin = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "apps/admin/.env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
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
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(`${url}/rest/v1/store_settings?select=id,avatar_styles&id=eq.1`, { headers });
if (!res.ok) throw new Error(`store_settings: ${res.status} ${await res.text()}`);
const [row] = await res.json();
const styles = Array.isArray(row?.avatar_styles) ? row.avatar_styles : [];
if (!styles.length) {
  console.log("No AI styles saved in the admin yet — the shop uses the built-in WebP samples. Nothing to do.");
  process.exit(0);
}

const done = new Map();
let before = 0;
let after = 0;

/** The URL to keep for a picture: a new small WebP, or the same one if it's already small. */
async function shrink(src, maxPx) {
  // built-in samples ship with the shop as WebP already
  if (!/^https?:\/\//.test(src)) return src;
  if (done.has(src)) return done.get(src);
  const got = await fetch(src);
  if (!got.ok) {
    console.warn(`  ! could not download ${src} (${got.status}) — left as it is`);
    done.set(src, src);
    return src;
  }
  const bytes = Buffer.from(await got.arrayBuffer());
  if (bytes.length < SMALL_ENOUGH) {
    done.set(src, src);
    return src;
  }
  const webp = await sharp(bytes)
    .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 90 })
    .toBuffer();
  const base = (src.split("/").pop() ?? "avatar").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-");
  const objectKey = `avatar/${base}-${maxPx}.webp`;
  // same host as the original (the shop rewrites the r2.dev host itself)
  const next = `${src.slice(0, src.lastIndexOf("/"))}/${objectKey}`;
  before += bytes.length;
  after += webp.length;
  console.log(`  ${base.slice(0, 48)}: ${Math.round(bytes.length / 1024)} KB → ${Math.round(webp.length / 1024)} KB`);
  if (!dry) {
    await r2.send(
      new PutObjectCommand({
        Bucket: admin.R2_BUCKET,
        Key: objectKey,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }
  done.set(src, next);
  return next;
}

const updated = [];
for (const style of styles) {
  const covers = [];
  for (const src of style.covers ?? []) covers.push(await shrink(src, SIZES.covers));
  const images = [];
  for (const src of style.images ?? []) images.push(await shrink(src, SIZES.images));
  updated.push({ ...style, covers, images });
}

const changed = [...done].filter(([from, to]) => from !== to).length;
console.log(
  `${changed} picture(s): ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB` +
    (dry ? " (dry run — nothing uploaded or saved)" : "")
);
if (dry || !changed) process.exit(0);

const backup = path.join(root, `.avatar-styles-backup-${ref}-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify(styles, null, 1));
console.log(`Old style list saved to ${path.relative(root, backup)}`);

const save = await fetch(`${url}/rest/v1/store_settings?id=eq.${row.id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ avatar_styles: updated }),
});
if (!save.ok) throw new Error(`saving the styles failed: ${save.status} ${await save.text()}`);
console.log("✔ AI styles now use the small pictures (live on the next page load).");
