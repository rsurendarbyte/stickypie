// Makes the 240px copy of each AI style card picture (admin → Avatar book), next
// to the 512px one in the R2 bucket: same name with ".s240.webp" at the end. The
// shop's hero draws these cards small (apps/web/src/lib/avatar-card-small.ts) and
// falls back to the full picture when a copy is missing. The admin makes the copy
// itself for new uploads; this fills in the pictures uploaded before that.
//
//   npm run avatar:small                 → card pictures in the dev database
//   npm run avatar:small -- --prod       → card pictures in the production database
//   npm run avatar:small -- --prod --dry → only list what would be made
//
// Only adds files to the bucket (never changes or deletes one, never writes the
// database). Safe to re-run: copies that already exist are skipped.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const SMALL_PX = 240;
const dry = process.argv.includes("--dry");
const { url, key } = loadTargetEnv();

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
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const res = await fetch(`${url}/rest/v1/store_settings?select=avatar_styles&id=eq.1`, { headers });
if (!res.ok) throw new Error(`store_settings: ${res.status} ${await res.text()}`);
const [row] = await res.json();
const covers = [...new Set((row?.avatar_styles ?? []).flatMap((s) => s.covers ?? []))];

let made = 0;
let skipped = 0;
let before = 0;
let after = 0;
for (const src of covers) {
  // built-in samples ship with the shop; only uploaded WebPs get a copy
  if (!/^https?:\/\/.+\.webp$/.test(src) || src.endsWith(".s240.webp")) continue;
  const small = src.replace(/\.webp$/, ".s240.webp");
  const head = await fetch(small, { method: "HEAD" });
  if (head.ok) {
    skipped++;
    continue;
  }
  const got = await fetch(src);
  if (!got.ok) {
    console.warn(`  ! could not download ${src} (${got.status})`);
    continue;
  }
  const bytes = Buffer.from(await got.arrayBuffer());
  const webp = await sharp(bytes)
    .resize(SMALL_PX, SMALL_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();
  const objectKey = decodeURIComponent(new URL(small).pathname.slice(1));
  before += bytes.length;
  after += webp.length;
  made++;
  console.log(`  ${objectKey.slice(0, 70)}: ${Math.round(bytes.length / 1024)} KB → ${Math.round(webp.length / 1024)} KB`);
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
}
console.log(
  `${made} copy(ies) ${dry ? "to make" : "made"} (${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB), ${skipped} already there`
);
