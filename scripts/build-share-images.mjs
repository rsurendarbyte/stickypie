// Link-preview pictures for sharing (WhatsApp, Instagram DMs, Facebook, X…):
// 1200 × 630 JPEGs, small enough (~100 KB) for every app to show at once.
//   share/<slug>.jpg         the mini poster              → /sticker/<slug>
//   share/<slug>-puzzle.jpg  "Can you solve this?" puzzle  → /puzzle/<slug>
//
//   node scripts/build-share-images.mjs --out <folder>   → write them to a folder only (try-out)
//   node scripts/build-share-images.mjs --upload         → upload to R2 (dev database's posters)
//   node scripts/build-share-images.mjs --upload --prod  → production database's posters
//   add --all to redo pictures that already exist; --only <slug> for one poster
//
// The pages point at these fixed paths (apps/web/src/lib/share.ts), so run it
// after adding posters. Same R2 bucket and keys as build-thumbs.mjs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const sharp = require("sharp");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const outDir = value("--out");
const upload = flag("--upload");
const only = value("--only");
if (!outDir && !upload) {
  console.error("Say where: --out <folder> (try-out) or --upload (R2).");
  process.exit(1);
}

const { url, key } = loadTargetEnv();
const W = 1200;
const H = 630;
const BRAND = "#ef5a28";
const INK = "#1d1712";

const admin = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "apps/admin/.env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
let r2 = null;
if (upload) {
  const { S3Client } = require("@aws-sdk/client-s3");
  r2 = new S3Client({
    region: "auto",
    endpoint: `https://${admin.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: admin.R2_ACCESS_KEY_ID, secretAccessKey: admin.R2_SECRET_ACCESS_KEY },
  });
}
const publicUrl = (admin.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const title = (name) => name.replace(/\s*(—\s*)?Mini Poster\s*$/i, "").trim() || name;
/** Splits a long name over two lines of about `max` characters. */
function lines(text, max) {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  let a = "";
  while (words.length && (a + " " + words[0]).trim().length <= max) a = (a + " " + words.shift()).trim();
  const b = words.join(" ");
  return [a, b.length > max ? b.slice(0, max - 1).trimEnd() + "…" : b];
}

async function picture(p) {
  const src = p.display_url ?? p.image_url;
  if (!/^https?:\/\//.test(src)) return fs.readFileSync(path.join(root, "apps/web/public", src.replace(/^\/+/, "")));
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** A soft, warm backdrop: the poster itself, blurred and washed out. */
async function backdrop(img) {
  return sharp(img).resize(W, H, { fit: "cover" }).blur(40).modulate({ brightness: 1.05, saturation: 0.9 }).toBuffer();
}

function text(svgBody) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgBody}</svg>`);
}

/** The mini poster, upright on the left; its name and what it is on the right. */
async function posterCard(p, img) {
  const ph = 540;
  const pw = Math.round(ph * (2 / 3));
  const poster = await sharp(img).resize(pw, ph, { fit: "cover" }).toBuffer();
  const framed = await sharp({ create: { width: pw + 16, height: ph + 16, channels: 4, background: "#ffffff" } })
    .composite([{ input: poster, left: 8, top: 8 }])
    .png()
    .toBuffer();
  const name = lines(title(p.name), 22);
  const overlay = text(`
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fffaf5" opacity="0.72"/>
    <rect x="96" y="${(H - ph) / 2 + 22}" width="${pw + 16}" height="${ph + 16}" rx="10" fill="#000" opacity="0.18"/>
    <text x="520" y="200" font-family="Arial" font-weight="700" font-size="26" fill="${BRAND}" letter-spacing="3">MINI POSTER</text>
    ${name.map((l, i) => `<text x="520" y="${262 + i * 66}" font-family="Arial Black, Arial" font-weight="900" font-size="58" fill="${INK}">${esc(l)}</text>`).join("")}
    <text x="520" y="${290 + name.length * 66}" font-family="Arial" font-size="30" fill="#5b5048">Wall poster · Sticker · 9-piece puzzle</text>
    <rect x="520" y="${330 + name.length * 66}" rx="30" width="290" height="60" fill="${BRAND}"/>
    <text x="665" y="${370 + name.length * 66}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="28" fill="#fff">Shop on StickyPie</text>
    <text x="1104" y="590" text-anchor="end" font-family="Arial Black, Arial" font-weight="900" font-size="30" fill="${INK}">StickyPie.in</text>`);
  return sharp(await backdrop(img))
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: framed, left: 88, top: Math.round((H - ph) / 2) - 8 },
    ])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

/** The poster shuffled into its 9 cards on a dark board, and the challenge. */
async function puzzleCard(p, img) {
  const ph = 510;
  const pw = Math.round(ph * (2 / 3));
  const tileW = Math.floor(pw / 3);
  const tileH = Math.floor(ph / 3);
  const gap = 8;
  // trim the picture's rounded corners (as the game does), or the corner cards give themselves away
  const edge = 0.035;
  const bigW = Math.round((tileW * 3) / (1 - 2 * edge));
  const bigH = Math.round((tileH * 3) / (1 - 2 * edge));
  const whole = await sharp(img)
    .resize(bigW, bigH, { fit: "cover" })
    .extract({ left: Math.round(bigW * edge), top: Math.round(bigH * edge), width: tileW * 3, height: tileH * 3 })
    .toBuffer();
  // a fixed mix that keeps a couple of cards right, so it reads as "almost there"
  const order = [5, 0, 7, 3, 4, 1, 8, 6, 2];
  const boardW = tileW * 3 + gap * 4;
  const boardH = tileH * 3 + gap * 4;
  const tiles = [];
  for (let slot = 0; slot < 9; slot++) {
    const t = order[slot];
    const tile = await sharp(whole)
      .extract({ left: (t % 3) * tileW, top: Math.floor(t / 3) * tileH, width: tileW, height: tileH })
      .toBuffer();
    tiles.push({ input: tile, left: gap + (slot % 3) * (tileW + gap), top: gap + Math.floor(slot / 3) * (tileH + gap) });
  }
  const board = await sharp({ create: { width: boardW, height: boardH, channels: 4, background: "#24170f" } })
    .composite(tiles)
    .png()
    .toBuffer();
  const name = lines(title(p.name), 24);
  const top = 150;
  const overlay = text(`
    <rect x="0" y="0" width="${W}" height="${H}" fill="#fffaf5" opacity="0.7"/>
    <rect x="${80 - 6}" y="${(H - boardH) / 2 + 14}" width="${boardW + 12}" height="${boardH + 12}" rx="18" fill="#000" opacity="0.25"/>
    <text x="520" y="${top}" font-family="Arial" font-weight="700" font-size="26" fill="${BRAND}" letter-spacing="3">PUZZLE CHALLENGE</text>
    <text x="520" y="${top + 76}" font-family="Arial Black, Arial" font-weight="900" font-size="68" fill="${INK}">Can you solve</text>
    <text x="520" y="${top + 152}" font-family="Arial Black, Arial" font-weight="900" font-size="68" fill="${INK}">this poster?</text>
    ${name.map((l, i) => `<text x="520" y="${top + 212 + i * 40}" font-family="Arial" font-size="32" fill="#5b5048">${esc(l)}</text>`).join("")}
    <rect x="520" y="${top + 238 + name.length * 40}" rx="32" width="400" height="64" fill="${BRAND}"/>
    <text x="560" y="${top + 281 + name.length * 40}" font-family="Arial" font-weight="700" font-size="30" fill="#fff">Play &amp; win</text>
    <rect x="730" y="${top + 248 + name.length * 40}" rx="10" width="170" height="44" fill="#ffd23f"/>
    <text x="815" y="${top + 281 + name.length * 40}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="28" fill="#2a1a00">10% OFF</text>
    <text x="1104" y="590" text-anchor="end" font-family="Arial Black, Arial" font-weight="900" font-size="30" fill="${INK}">StickyPie.in</text>`);
  return sharp(await backdrop(img))
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: board, left: 80, top: Math.round((H - boardH) / 2) },
    ])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const products = await (
  await fetch(`${url}/rest/v1/products?select=slug,name,image_url,display_url,tags,pack_items,is_active&is_active=eq.true`, { headers })
).json();
if (!Array.isArray(products)) throw new Error(`products query failed: ${JSON.stringify(products).slice(0, 200)}`);
const posters = products.filter(
  (p) =>
    (p.slug.endsWith("-mini-poster") || (p.tags ?? []).some((t) => t.toLowerCase() === "mini poster")) &&
    !(p.pack_items ?? []).length &&
    (!only || p.slug === only)
);
console.log(`${posters.length} mini poster(s)`);

/** Already uploaded (skipped unless --all). */
async function exists(objectKey) {
  if (!publicUrl || flag("--all")) return false;
  const res = await fetch(`${publicUrl}/${objectKey}`, { method: "HEAD" });
  return res.ok;
}

async function save(objectKey, body) {
  if (outDir) {
    fs.mkdirSync(path.join(outDir, path.dirname(objectKey)), { recursive: true });
    fs.writeFileSync(path.join(outDir, objectKey), body);
  }
  if (upload) {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    await r2.send(
      new PutObjectCommand({
        Bucket: admin.R2_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: "image/jpeg",
        // the same path is redone when a poster's picture changes: a day, not forever
        CacheControl: "public, max-age=86400",
      })
    );
  }
}

let done = 0;
async function one(p) {
  try {
    const keys = [`share/${p.slug}.jpg`, `share/${p.slug}-puzzle.jpg`];
    if (upload && !outDir && (await exists(keys[0])) && (await exists(keys[1]))) return;
    const img = await picture(p);
    const a = await posterCard(p, img);
    const b = await puzzleCard(p, img);
    await save(keys[0], a);
    await save(keys[1], b);
    done++;
    console.log(`  ✔ ${p.slug}  ${Math.round(a.length / 1024)} KB + ${Math.round(b.length / 1024)} KB`);
  } catch (err) {
    console.log(`  ✘ ${p.slug}: ${err instanceof Error ? err.message : err}`);
  }
}
// a few at a time: the checks and uploads are network waits, not work
const queue = [...posters];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await one(queue.shift());
}));
console.log(`✔ ${done} poster(s) done.`);
