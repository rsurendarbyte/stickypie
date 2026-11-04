// Draws wall setups from the shop's own posters: big 6 × 9 in posters with
// 4 × 6 in ones around them (the only sizes sold), on a room wall. Pictures go
// to prod_stickers/wall-setups/.
//
//   node scripts/make-wall-setups.mjs            → previews, posters from the dev database
//   node scripts/make-wall-setups.mjs --prod     → previews, posters from production
//   add --save to also save them as wall sets (poster packs) in that database,
//   and --prices to reset the prices of sets already saved
//   --themes makes the rows of about 10 sets per theme instead (--only=cars,travel for some)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const OUT = path.join(root, "prod_stickers/wall-setups");
const W = 1600;
const H = 2400; // 2:3, the shape of a poster set card
const WALL_BOTTOM = 2160; // where the desk starts
const GAP = 0.3; // inches between posters
const IMAGE_HOST = "https://stickers.stickypie.in";
const SMALL = { w: 4, h: 6 };
const BIG = { w: 6, h: 9 };

// pack: id in packs.json; its first poster goes big.
const SETUPS = [
  { pack: "car-wall-20", file: "car-wall", theme: "cars", title: "Dream Garage Wall Setup", layout: "centre", wall: ["#ded9d0", "#cfc8bc"], desk: "#7a5436" },
  { pack: "motivation", file: "motivation", theme: "motivational", title: "Do It Now Wall Setup", layout: "side", wall: ["#3a3f47", "#2c3036"], desk: "#26231f" },
  { pack: "world-traveller", file: "world-traveller", theme: "travel", title: "World Traveller Wall Setup", layout: "trio", wall: ["#e7dfd2", "#d9cdbb"], desk: "#a97c50" },
  { pack: "har-har-mahadev", file: "mahadev", theme: "devotional", title: "Mahadev Wall Setup", layout: "centre", wall: ["#c9cdc2", "#b4baab"], desk: "#6b4a2f" },
  { pack: "swag-pop", file: "swag-pop", title: "Swag Pop Wall Setup", layout: "side", wall: ["#e6e7ea", "#d3d5da"], desk: "#2f2f33" },
  { pack: "incredible-india", file: "incredible-india", theme: "india", title: "Incredible India Wall Setup", layout: "trio", wall: ["#d9b99b", "#c8a382"], desk: "#5d3f28" },
];

// Rows of wall sets: each set is drawn from these poster categories (not festival
// posters, which go out of date), in matching colours. Names must stay unique.
const THEMES = [
  {
    id: "cars",
    categories: ["Cars", "Racing", "Petrolhead"],
    names: ["Red Line Legends", "Night Garage", "Pit Lane Heroes", "Blueprint Bay", "Sunset Cruisers", "Track Day", "Chrome & Steel", "Garage Goals", "Grand Tourers", "Midnight Drive"],
  },
  {
    id: "ride",
    categories: ["Bikers", "Off-Road", "Adventure"],
    names: ["Open Road", "Trail Blazers", "Mud & Mountains", "Born to Ride", "Wild Tracks", "Highway Soul", "Off the Map", "Peak Chasers", "Dust Riders", "Long Way Home"],
  },
  {
    id: "travel",
    categories: ["Travel"],
    names: ["Passport Stamps", "Wander Wall", "Sunset Cities", "Map Lovers", "Far Away Places", "Weekend Escape", "Globe Trotter", "Postcard Wall", "City Lights", "Dream Destinations"],
  },
  {
    id: "india",
    categories: ["Cities & States", "Desi"],
    names: ["Desi Pride", "Namma Ooru", "Colours of India", "Heritage Walk", "City Roots", "Hometown Love", "Southern Stories", "Mera Bharat", "Old Town Charm", "Desi Dreams"],
  },
  {
    id: "devotional",
    categories: ["Devotional"],
    names: ["Divine Grace", "Sacred Corner", "Om Shanti", "Bhakti Wall", "Peaceful Pooja", "Blessed Home", "Eternal Faith", "Golden Glow", "Temple Bells", "Inner Calm"],
  },
  {
    id: "motivational",
    categories: ["Motivational"],
    names: ["Rise & Grind", "No Excuses", "Dream Big", "Stay Hungry", "Hustle Hard", "Mindset Wall", "Keep Going", "Focus Mode", "Own Your Day", "Winner's Corner"],
  },
  {
    id: "retro",
    categories: ["Retro & Vintage"],
    names: ["Golden Era", "Old School", "Vintage Vibes", "Classic Corner", "Throwback Wall", "Sepia Days", "Retro Rewind", "Timeless Prints", "Yesterday's Cool", "Antique Dreams"],
  },
];
// Layout and poster count for set 1, 2, 3… of a theme.
const CYCLE = [["centre", 8], ["trio", 9], ["side", 8], ["centre", 14], ["trio", 7], ["trio", 11], ["centre", 6], ["side", 10], ["trio", 9], ["centre", 8]];
const ROOMS = [
  { wall: ["#ded9d0", "#cfc8bc"], desk: "#7a5436" },
  { wall: ["#3a3f47", "#2c3036"], desk: "#26231f" },
  { wall: ["#e7dfd2", "#d9cdbb"], desk: "#a97c50" },
  { wall: ["#c9cdc2", "#b4baab"], desk: "#6b4a2f" },
  { wall: ["#e6e7ea", "#d3d5da"], desk: "#2f2f33" },
  { wall: ["#d9b99b", "#c8a382"], desk: "#5d3f28" },
];

/** Spots on the wall, inches from the top left: big posters first, always even, no leftovers. */
function layoutSpots(name, count) {
  const rowH = SMALL.h + GAP;
  const colW = SMALL.w + GAP;
  const bigW = BIG.w + GAP;
  const bigH = BIG.h + GAP;
  const small = (x, y) => ({ x, y, ...SMALL });
  const big = (x, y) => ({ x, y, ...BIG });
  const height = BIG.h * 2 + GAP;
  const column = (x, rows) => {
    const top = (height - (rows * rowH - GAP)) / 2;
    return Array.from({ length: rows }, (_, r) => small(x, top + r * rowH));
  };
  if (name === "trio") {
    const perRow = Math.min(4, Math.floor((count - 3) / 2));
    const inset = (bigW * 3 - GAP - (perRow * colW - GAP)) / 2;
    const row = (y) => Array.from({ length: perRow }, (_, i) => small(inset + i * colW, y));
    return [big(0, rowH), big(bigW, rowH), big(bigW * 2, rowH), ...row(0), ...row(rowH + bigH)];
  }
  if (name === "side") {
    // Four big posters together, small ones beside them.
    const left = bigW * 2;
    const cols = count >= 13 ? 3 : 2;
    const rows = Math.min(3, Math.floor((count - 4) / cols));
    const grid = Array.from({ length: cols }, (_, c) => column(left + c * colW, rows)).flat();
    return [big(0, 0), big(bigW, 0), big(0, bigH), big(bigW, bigH), ...grid];
  }
  // Two big posters stacked in the middle, small ones either side.
  const rest = count - 2;
  const wide = rest >= 12;
  const rows = Math.min(3, Math.floor((wide ? rest / 2 : rest) / 2));
  const left = wide ? colW * 2 : colW;
  const right = left + bigW;
  const sides = [column(left - colW, rows), column(right, rows)];
  if (wide) sides.push(column(0, rows), column(right + colW, rows));
  return [big(left, 0), big(left, bigH), ...sides.flat()];
}

function room(wall, desk) {
  const [a, b] = wall;
  const d = WALL_BOTTOM;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="light" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></radialGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>
    <linearGradient id="cast" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="lamp" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.34"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="${W}" height="${d}" fill="url(#w)"/>
  <rect width="${W}" height="${d}" fill="url(#light)"/>
  <rect y="${d - 70}" width="${W}" height="70" fill="url(#cast)"/>
  <rect y="${d}" width="${W}" height="${H - d}" fill="${desk}"/>
  <rect y="${d}" width="${W}" height="${H - d}" fill="url(#top)"/>
  <!-- lamp glow -->
  <path d="M1335 ${d - 250} L1120 ${d} L1550 ${d} Z" fill="url(#lamp)" filter="url(#soft)"/>
  <!-- laptop, closed -->
  <ellipse cx="800" cy="${d + 62}" rx="300" ry="16" fill="#000" opacity="0.28" filter="url(#soft)"/>
  <path d="M530 ${d + 54} L580 ${d + 18} L1020 ${d + 18} L1070 ${d + 54} Z" fill="#a9acb2"/>
  <rect x="530" y="${d + 54}" width="540" height="9" rx="4" fill="#7d8086"/>
  <!-- mug -->
  <rect x="1115" y="${d - 26}" width="66" height="74" rx="10" fill="#e9e4da"/>
  <path d="M1181 ${d - 8} h16 a16 16 0 0 1 0 34 h-16" fill="none" stroke="#e9e4da" stroke-width="9"/>
  <!-- lamp -->
  <ellipse cx="1335" cy="${d + 36}" rx="80" ry="12" fill="#17171a"/>
  <rect x="1330" y="${d - 240}" width="10" height="272" fill="#17171a"/>
  <path d="M1250 ${d - 225} q85 -105 170 0 z" fill="#17171a"/>
  <!-- plant -->
  <ellipse cx="265" cy="${d + 44}" rx="80" ry="12" fill="#000" opacity="0.26" filter="url(#soft)"/>
  <path d="M205 ${d - 60} h120 l-14 104 h-92 z" fill="#efe9df"/>
  <path d="M265 ${d - 60} C215 ${d - 140} 165 ${d - 150} 140 ${d - 225} C215 ${d - 205} 262 ${d - 160} 265 ${d - 60}Z" fill="#3f6b48"/>
  <path d="M265 ${d - 60} C295 ${d - 165} 350 ${d - 180} 385 ${d - 250} C325 ${d - 235} 270 ${d - 175} 265 ${d - 60}Z" fill="#4e8259"/>
  <path d="M265 ${d - 60} C248 ${d - 170} 256 ${d - 250} 282 ${d - 310} C305 ${d - 230} 290 ${d - 150} 265 ${d - 60}Z" fill="#35603f"/>
</svg>`);
}

const rounded = (w, h, r) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);

async function piece(buffer, w, h, left, top) {
  const data = await sharp(buffer).resize(w, h, { fit: "cover" }).composite([{ input: rounded(w, h, 3), blend: "dest-in" }]).png().toBuffer();
  const pad = 26;
  const shadow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.42 } } }).png().toBuffer(), left: pad, top: pad }])
    .png()
    .toBuffer();
  return [
    { input: await sharp(shadow).blur(9).png().toBuffer(), left: left - pad + 5, top: top - pad + 9 },
    { input: data, left, top },
  ];
}

async function draw(setup, posters) {
  const spots = layoutSpots(setup.layout, posters.length);
  const width = Math.max(...spots.map((s) => s.x + s.w));
  const height = Math.max(...spots.map((s) => s.y + s.h));
  const scale = Math.min((W * 0.86) / width, (WALL_BOTTOM - 560) / height);
  const ox = Math.round((W - width * scale) / 2);
  const oy = Math.round((WALL_BOTTOM - 340 - height * scale) / 2 + 40);
  const layers = [];
  for (const [i, s] of spots.entries()) {
    layers.push(...(await piece(posters[i], Math.round(s.w * scale), Math.round(s.h * scale), ox + Math.round(s.x * scale), oy + Math.round(s.y * scale))));
  }
  const file = path.join(OUT, `${setup.file}.jpg`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(room(setup.wall, setup.desk)).composite(layers).jpeg({ quality: 88 }).toFile(file);
  return { file, sizes: spots.map((s) => s.h), feet: `${(width / 12).toFixed(1)} × ${(height / 12).toFixed(1)} ft` };
}

const { url, key, args } = loadTargetEnv();
const save = args.includes("--save");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function rest(query, init = {}) {
  const res = await fetch(`${url}/rest/v1/${query}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${query.split("?")[0]} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const envFile = Object.fromEntries(
  fs
    .readFileSync(path.join(root, "apps/admin/.env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);

async function put(objectKey, body, contentType) {
  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${envFile.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: envFile.R2_ACCESS_KEY_ID, secretAccessKey: envFile.R2_SECRET_ACCESS_KEY },
  });
  await r2.send(
    new PutObjectCommand({ Bucket: envFile.R2_BUCKET, Key: objectKey, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" })
  );
  return `${IMAGE_HOST}/${objectKey}`;
}

/** Saves one setup as a poster pack with its room picture as the cover (found again by slug). */
async function saveSetup(setup, tags, rows, done) {
  const [category] = await rest("categories?slug=eq.poster-packs&select=id");
  const slug = `${path.basename(setup.file)}-wall-setup`;
  const ts = Date.now();
  const master = await sharp(done.file).toBuffer();
  const row = {
    slug,
    name: `${setup.title} — ${done.sizes.length} Mini Poster Pack`,
    description: `A ready wall setup of ${done.sizes.length} posters, about ${done.feet} on your wall, printed on 300 GSM poster paper. Glue dots or double-sided tape included.`,
    image_url: await put(`packs/${slug}-${ts}.jpg`, master, "image/jpeg"),
    aspect_ratio: W / H,
    category_ids: [category.id],
    category_id: category.id,
    pack_items: rows.map((r) => r.id),
    pack_sizes: done.sizes,
    tags: ["poster pack", "wall setup", ...(setup.theme ? [`wall theme:${setup.theme}`] : []), ...tags],
  };
  for (const [column, maxPx, quality, prefix] of [["thumb_url", 480, 80, "thumbs"], ["display_url", 1024, 82, "display"]]) {
    const webp = await sharp(master).resize(maxPx, maxPx, { fit: "inside" }).webp({ quality }).toBuffer();
    row[column] = await put(`${prefix}/${slug}-${maxPx}-${ts}.webp`, webp, "image/webp");
  }
  const [existing] = await rest(`products?slug=eq.${slug}&select=id`);
  // Starting price by poster: change it in the admin any time (--prices resets it).
  const price = Math.ceil((done.sizes.length * 69) / 50) * 50 - 1;
  const priced = { price, compare_at_price: price * 2 };
  if (existing) {
    const patch = args.includes("--prices") ? { ...row, ...priced } : row;
    await rest(`products?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  } else {
    await rest("products", {
      method: "POST",
      body: JSON.stringify({ ...row, ...priced, sizes: [], is_active: true, is_new: true, featured: false, stock: null }),
    });
  }
  return row.name;
}
const packs = JSON.parse(fs.readFileSync(path.join(root, "prod_stickers/poster-packs/packs.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
for (const setup of args.includes("--themes") ? [] : SETUPS) {
  const pack = packs.find((p) => p.id === setup.pack);
  if (!pack) {
    console.log(`✘ no pack "${setup.pack}" (ids: ${packs.map((p) => p.id).join(", ")})`);
    continue;
  }
  const slugs = pack.items.map((s) => (s.endsWith("-mini-poster") ? s : `${s}-mini-poster`));
  const res = await fetch(`${url}/rest/v1/products?slug=in.(${slugs.join(",")})&select=id,slug,image_url`, { headers });
  const rows = await res.json();
  const order = slugs.flatMap((s) => rows.filter((r) => r.slug === s)).slice(0, 14);
  const posters = [];
  for (const row of order) {
    const r = await fetch(row.image_url);
    if (!r.ok) throw new Error(`no picture for ${row.slug}`);
    posters.push(Buffer.from(await r.arrayBuffer()));
  }
  if (posters.length < 5) {
    console.log(`✘ ${pack.name}: only ${posters.length} posters`);
    continue;
  }
  const done = await draw(setup, posters);
  results.push(done.file);
  if (save) console.log(`  saved ${await saveSetup(setup, pack.tags, order.slice(0, done.sizes.length), done)}`);
  console.log(`✓ ${pack.name}: ${done.sizes.filter((n) => n === 9).length} × 6 × 9 in, ${done.sizes.filter((n) => n === 6).length} × 4 × 6 in, ${done.feet}`);
}

/** Hue of a poster's main colour (0–360), for sets that match. */
function hue({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const kebab = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function picture(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  }
  throw new Error(`no picture at ${url}`);
}

if (args.includes("--themes")) {
  const categories = await rest("categories?select=id,name");
  const posters = await rest("products?slug=like.*-mini-poster&is_active=eq.true&select=id,slug,image_url,display_url,thumb_url,category_ids,tags&limit=500");
  const pictures = new Map();
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  for (const theme of THEMES.filter((t) => !only || only.includes(t.id))) {
    const ids = new Set(categories.filter((c) => theme.categories.includes(c.name)).map((c) => c.id));
    const pool = posters.filter((p) => (p.category_ids ?? []).some((id) => ids.has(id)) && !(p.tags ?? []).some((t) => /festival|diwali/i.test(t)));
    for (const p of pool) {
      if (pictures.has(p.id)) continue;
      try {
        const buffer = await picture(p.display_url ?? p.image_url);
        const { dominant } = await sharp(buffer).stats();
        pictures.set(p.id, { buffer, hue: hue(dominant) });
      } catch (err) {
        console.log(`  skipped ${p.slug}: ${err.message}`);
      }
    }
    // In colour order: neighbours match, and each set starts further round the wheel.
    const ordered = pool.filter((p) => pictures.has(p.id)).sort((a, b) => pictures.get(a.id).hue - pictures.get(b.id).hue);
    if (ordered.length < 9) {
      console.log(`✘ ${theme.id}: only ${ordered.length} posters, skipped`);
      continue;
    }
    let saved = 0;
    for (const [i, name] of theme.names.entries()) {
      const [layout, wanted] = CYCLE[i % CYCLE.length];
      const count = Math.min(wanted, ordered.length);
      const start = Math.floor((i * ordered.length) / theme.names.length);
      const rows = Array.from({ length: count }, (_, k) => ordered[(start + k) % ordered.length]);
      const room = ROOMS[(i + THEMES.indexOf(theme)) % ROOMS.length];
      const setup = { file: `${theme.id}/${kebab(name)}`, theme: theme.id, title: `${name} Wall Setup`, layout, ...room };
      const done = await draw(setup, rows.map((r) => pictures.get(r.id).buffer));
      if (save) await saveSetup(setup, [theme.id], rows.slice(0, done.sizes.length), done);
      saved++;
    }
    console.log(`✓ ${theme.id}: ${saved} sets from ${pool.length} posters`);
  }
}

// One sheet of all of them, to compare.
if (results.length) {
  const cols = 3;
  const cw = 640;
  const ch = 960;
  const rows = Math.ceil(results.length / cols);
  const tiles = await Promise.all(
    results.map(async (f, i) => ({
      input: await sharp(f).resize(cw, ch).toBuffer(),
      left: (i % cols) * (cw + 20) + 20,
      top: Math.floor(i / cols) * (ch + 20) + 20,
    }))
  );
  await sharp({ create: { width: cols * (cw + 20) + 20, height: rows * (ch + 20) + 20, channels: 3, background: "#ffffff" } })
    .composite(tiles)
    .jpeg({ quality: 85 })
    .toFile(path.join(OUT, "overview.jpg"));
}
