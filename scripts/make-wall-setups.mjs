// Draws wall setups from the shop's own posters: big 6 × 9 in posters with
// 4 × 6 in ones around them (the only sizes sold), hung on a painted gallery wall. Pictures go
// to prod_stickers/wall-setups/.
//
//   node scripts/make-wall-setups.mjs            → previews, posters from the dev database
//   node scripts/make-wall-setups.mjs --prod     → previews, posters from production
//   --older gives the older poster packs a wall of their real posters (no picture drawn)
//   add --save to also save them as wall sets (poster packs) in that database,
//   and --prices to reset the prices of sets already saved
//   --themes makes the rows of about 10 sets per theme instead (--only=cars,travel for some)
//   --sets=<file> makes the sets picked in that file instead
//   --draft (with --sets --save) saves them hidden, tagged "awaiting approval", for the
//   admin's Approve page; it never touches a wall that already exists
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const require = createRequire(path.join(root, "apps/admin/package.json"));
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const OUT = path.join(root, "prod_stickers/wall-setups");
const W = 1600;
const H = 1600; // square, the shape of a wall card: the posters fill it
const GAP = 0.3; // inches between posters
const IMAGE_HOST = "https://stickers.stickypie.in";
const SMALL = { w: 4, h: 6 };
const BIG = { w: 6, h: 9 };
/** One price per wall, by number of posters. */
const WALL_PRICES = { 4: 199, 6: 199, 7: 229, 8: 259, 9: 279, 10: 299, 11: 329, 12: 349, 14: 379, 20: 459, 30: 549 };

// pack: id in packs.json; its first poster goes big.
const SETUPS = [
  { pack: "car-wall-20", file: "car-wall", theme: "cars", title: "Dream Garage Wall Setup", layout: "centre" },
  { pack: "motivation", file: "motivation", theme: "motivational", title: "Do It Now Wall Setup", layout: "side" },
  { pack: "world-traveller", file: "world-traveller", theme: "travel", title: "World Traveller Wall Setup", layout: "trio" },
  { pack: "har-har-mahadev", file: "mahadev", theme: "devotional", title: "Mahadev Wall Setup", layout: "centre" },
  { pack: "swag-pop", file: "swag-pop", title: "Swag Pop Wall Setup", layout: "side" },
  { pack: "incredible-india", file: "incredible-india", theme: "india", title: "Incredible India Wall Setup", layout: "trio" },
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
// Wall paint: soft colours, never dark, so the posters stay the loudest thing.
const SAGE = ["#c3cbbc", "#b2bbaa"];
const DUSTY_BLUE = ["#c0ccd5", "#aebbc6"];
const CLAY = ["#dcc3b0", "#cfb29c"];
const WARM_GREY = ["#d3cdc3", "#c4bdb2"];
const CREAM = ["#f1ece3", "#e2dacd"];
const BLUSH = ["#e6d3cd", "#dbc4bc"];
const PAINTS = {
  cars: [WARM_GREY, DUSTY_BLUE, SAGE],
  ride: [SAGE, CLAY, WARM_GREY],
  travel: [DUSTY_BLUE, CREAM, CLAY],
  india: [CLAY, CREAM, BLUSH],
  devotional: [CREAM, BLUSH, CLAY],
  motivational: [DUSTY_BLUE, WARM_GREY, BLUSH],
  retro: [CLAY, SAGE, CREAM],
  festive: [CREAM, SAGE, BLUSH],
};
const paintFor = (theme, i) => {
  const list = PAINTS[theme] ?? [CREAM, DUSTY_BLUE, SAGE];
  return { paint: list[i % list.length] };
};

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
  if (name === "grand") {
    // Two big posters in the middle, three columns either side, a row above and below.
    const left = colW * 3;
    const right = left + bigW;
    const band = rowH * 3 - GAP;
    const bigTop = rowH + (band - height) / 2;
    const side = (x) => Array.from({ length: 3 }, (_, r) => small(x, rowH + r * rowH));
    const inset = (right + colW * 3 - GAP - (5 * colW - GAP)) / 2;
    const row = (y) => Array.from({ length: 5 }, (_, i) => small(inset + i * colW, y));
    const columns = [0, colW, colW * 2, right, right + colW, right + colW * 2].flatMap(side);
    return [big(left, bigTop), big(left, bigTop + bigH), ...row(0), ...columns, ...row(rowH + band + GAP)];
  }
  // Month-by-month calendars: every poster 4 × 6 in, in poster order (January first).
  const grid = (perRow) => Array.from({ length: count }, (_, i) => small((i % perRow) * colW, Math.floor(i / perRow) * rowH));
  if (name === "calendar") return grid(4); // 4 across, 3 down
  if (name === "calendar-wide") return grid(6); // 6 across, 2 down: over a bed or desk
  if (name === "calendar-tall") return grid(3); // 3 across, 4 down: beside a door or cupboard
  if (name === "calendar-steps") {
    // 4 across, every other column dropped half a poster: a staggered wall.
    return Array.from({ length: count }, (_, i) => small((i % 4) * colW, Math.floor(i / 4) * rowH + (i % 2 ? rowH / 2 : 0)));
  }
  if (name === "calendar-clock") {
    // Months where the hours sit on a clock: January at 1 o'clock … December at 12.
    const r = 13.2;
    return Array.from({ length: count }, (_, i) => {
      const a = (((i + 1) % 12) / 12) * Math.PI * 2;
      return small(r + Math.sin(a) * r, r - Math.cos(a) * r);
    });
  }
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

/** Painted plaster: paint colour, fine grain, one soft light from the top left. */
async function plaster([a, b]) {
  const paint = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="l" cx="0.22" cy="0.1" r="1.1"><stop offset="0" stop-color="#fff" stop-opacity="0.26"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.1"/></radialGradient>
    </defs><rect width="${W}" height="${H}" fill="url(#p)"/><rect width="${W}" height="${H}" fill="url(#l)"/></svg>`);
  const grain = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 16 } } }).blur(0.7).png().toBuffer();
  return sharp(paint).composite([{ input: grain, blend: "soft-light" }]).png().toBuffer();
}

/** Paper print: art trimmed past its rounded corners, square edge, faint sheen. */
async function print(buffer, w, h) {
  const meta = await sharp(buffer).metadata();
  const trim = Math.round(meta.width * 0.025);
  const sheen = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.09"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.07"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/></svg>`);
  return sharp(buffer)
    .extract({ left: trim, top: trim, width: meta.width - trim * 2, height: meta.height - trim * 2 })
    .flatten({ background: "#ffffff" })
    .resize(w, h, { fit: "cover" })
    .composite([{ input: sheen }])
    .png()
    .toBuffer();
}

/** A shadow cast to the lower right. */
async function shadow(w, h, pad, blur, alpha) {
  const solid = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 25, g: 18, b: 12, alpha } } }).png().toBuffer();
  const layer = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: solid, left: pad, top: pad }])
    .png()
    .toBuffer();
  return sharp(layer).blur(blur).png().toBuffer();
}

async function piece(buffer, w, h, left, top) {
  const pad = 44;
  return [
    { input: await shadow(w, h, pad, 20, 0.34), left: left - pad + 12, top: top - pad + 18 },
    { input: await shadow(w, h, pad, 3, 0.4), left: left - pad + 2, top: top - pad + 3 },
    { input: await print(buffer, w, h), left, top },
  ];
}

async function draw(setup, posters) {
  const spots = layoutSpots(setup.layout, posters.length);
  const width = Math.max(...spots.map((s) => s.x + s.w));
  const height = Math.max(...spots.map((s) => s.y + s.h));
  const scale = Math.min((W * 0.92) / width, (H * 0.92) / height);
  const ox = Math.round((W - width * scale) / 2);
  const oy = Math.round((H - height * scale) / 2);
  const layers = [];
  for (const [i, s] of spots.entries()) {
    layers.push(...(await piece(posters[i], Math.round(s.w * scale), Math.round(s.h * scale), ox + Math.round(s.x * scale), oy + Math.round(s.y * scale))));
  }
  const file = path.join(OUT, `${setup.file}.jpg`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const feet = `${(width / 12).toFixed(1)} × ${(height / 12).toFixed(1)} ft`;
  await sharp(await plaster(setup.paint)).composite(layers).jpeg({ quality: 90 }).toFile(file);
  // Where each poster sits, as % of the picture: the shop animates them onto the wall.
  const percent = (n) => Math.round((n / W) * 10000) / 100;
  const places = spots
    .map((s) => [ox + Math.round(s.x * scale), oy + Math.round(s.y * scale), Math.round(s.w * scale), Math.round(s.h * scale)].map(percent).join(","))
    .join(";");
  return { file, sizes: spots.map((s) => s.h), feet, paint: setup.paint, places };
}

const { url, key, args } = loadTargetEnv();
const save = args.includes("--save");
const draft = args.includes("--draft");
const DRAFT_TAG = "awaiting approval";
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
    description: `A ready wall setup of ${done.sizes.length} posters, about ${done.feet} on your wall, printed on premium poster paper. Glue dots or double-sided tape included.`,
    image_url: await put(`packs/${slug}-${ts}.jpg`, master, "image/jpeg"),
    aspect_ratio: W / H,
    category_ids: [category.id],
    category_id: category.id,
    pack_items: rows.map((r) => r.id),
    pack_sizes: done.sizes,
    tags: ["poster pack", "wall setup", `wall size:${done.feet}`, `wall paint:${done.paint.join(",")}`, `wall spots:${done.places}`, ...(setup.theme ? [`wall theme:${setup.theme}`] : []), ...tags],
  };
  for (const [column, maxPx, quality, prefix] of [["tiny_url", 240, 72, "tiny"], ["thumb_url", 480, 80, "thumbs"], ["display_url", 1024, 82, "display"]]) {
    const webp = await sharp(master).resize(maxPx, maxPx, { fit: "inside" }).webp({ quality }).toBuffer();
    row[column] = await put(`${prefix}/${slug}-${maxPx}-${ts}.webp`, webp, "image/webp");
  }
  const [existing] = await rest(`products?slug=eq.${slug}&select=id`);
  if (draft && existing) throw new Error(`${setup.title}: a wall with this name already exists`);
  if (draft) row.tags.push(DRAFT_TAG);
  // Starting price by poster: change it in the admin any time (--prices resets it).
  const listed = Math.ceil((done.sizes.length * 69) / 50) * 50 - 1;
  const price = WALL_PRICES[done.sizes.length];
  if (!price) throw new Error(`no price set for a wall of ${done.sizes.length}`);
  const priced = { price, compare_at_price: listed };
  if (existing) {
    const patch = args.includes("--prices") ? { ...row, ...priced } : row;
    await rest(`products?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  } else {
    await rest("products", {
      method: "POST",
      body: JSON.stringify({ ...row, ...priced, sizes: [], is_active: !draft, is_new: true, featured: false, stock: null }),
    });
  }
  return row.name;
}
const packs = JSON.parse(fs.readFileSync(path.join(root, "prod_stickers/poster-packs/packs.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
for (const setup of args.some((a) => a === "--themes" || a === "--older" || a.startsWith("--sets=")) ? [] : SETUPS) {
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
  const done = await draw({ ...setup, ...paintFor(setup.theme, SETUPS.indexOf(setup)) }, posters);
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
    const pool = posters.filter((p) => (p.category_ids ?? []).some((id) => ids.has(id)) && !(p.tags ?? []).some((t) => /festival|diwali|wall set only/i.test(t)));
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
      const setup = { file: `${theme.id}/${kebab(name)}`, theme: theme.id, title: `${name.replace(/ Wall$/, "")} Wall Setup`, layout, ...paintFor(theme.id, i) };
      const done = await draw(setup, rows.map((r) => pictures.get(r.id).buffer));
      if (save) await saveSetup(setup, [theme.id], rows.slice(0, done.sizes.length), done);
      saved++;
    }
    console.log(`✓ ${theme.id}: ${saved} sets from ${pool.length} posters`);
  }
}

// Sets picked by hand: --sets=<file>, a list of { name, theme, layout, posters: [slugs], tags? }.
// tags: ["locked wall"] sells the set exactly as made (calendars): shoppers can't change its posters.
// The first posters in the list are the big ones.
const setsFile = args.find((a) => a.startsWith("--sets="))?.slice(7);
if (setsFile) {
  const list = JSON.parse(fs.readFileSync(path.resolve(root, setsFile), "utf8"));
  const slugs = [...new Set(list.flatMap((s) => s.posters))].map((s) => `${s}-mini-poster`);
  const posters = await rest(`products?slug=in.(${slugs.join(",")})&is_active=eq.true&select=id,slug,image_url,display_url`);
  const pictures = new Map();
  const made = [];
  const failed = [];
  for (const [i, set] of list.entries()) {
    try {
      const rows = set.posters.map((s) => {
        const row = posters.find((p) => p.slug === `${s}-mini-poster`);
        if (!row) throw new Error(`${set.name}: no poster ${s}`);
        return row;
      });
      if (new Set(rows).size !== rows.length) throw new Error(`${set.name}: a poster twice`);
      // a draft never replaces a wall: find out before drawing it
      if (draft && save && (await rest(`products?slug=eq.${kebab(set.name)}-wall-setup&select=id`)).length) throw new Error(`${set.name}: a wall with this name already exists`);
      for (const row of rows) if (!pictures.has(row.id)) pictures.set(row.id, await picture(row.display_url ?? row.image_url));
      const setup = { file: `${set.theme}/${kebab(set.name)}`, theme: set.theme, title: `${set.name} Wall Setup`, layout: set.layout, ...paintFor(set.theme, set.paint ?? i) };
      const done = await draw(setup, rows.map((r) => pictures.get(r.id)));
      if (done.sizes.length !== rows.length) throw new Error(`${set.name}: ${rows.length} posters, layout holds ${done.sizes.length}`);
      if (save) await saveSetup(setup, [set.theme, ...(set.tags ?? [])], rows, done);
      console.log(`✓ ${set.name}: ${rows.length} posters, ${done.feet}`);
      made.push(set.name);
    } catch (err) {
      // a daily draft run keeps going: one bad set shouldn't lose the others
      if (!draft) throw err;
      failed.push(err.message.startsWith(set.name) ? err.message : `${set.name}: ${err.message}`);
      console.log(`✘ ${failed.at(-1)}`);
    }
  }
  if (draft && save) {
    // shown under the Daily prompt on the admin's Approve page
    const [row] = await rest("store_settings?id=eq.1&select=features");
    const features = row?.features ?? {};
    const lastRun = { at: new Date().toISOString(), made, skipped: failed };
    await rest("store_settings?id=eq.1", { method: "PATCH", body: JSON.stringify({ features: { ...features, trendWalls: { ...features.trendWalls, lastRun } } }) });
  }
}

/**
 * Older packs keep their posters and sizes: this only works out a real wall for
 * them (small posters in rows, big ones in the first row) and tags it on. No
 * picture is drawn or changed. Spots follow the pack's poster order.
 */
function packSpots(sizes) {
  const bigs = sizes.filter((s) => s === 9).length;
  const smalls = sizes.length - bigs;
  const perRow = Math.max(3, Math.ceil(Math.sqrt(sizes.length)));
  const colW = SMALL.w + GAP;
  const rowH = SMALL.h + GAP;
  const beside = Math.min(smalls, Math.max(0, bigs ? perRow - bigs : 0));
  const first = [];
  let x = 0;
  const left = Math.floor(beside / 2);
  const topH = bigs ? BIG.h : SMALL.h;
  for (let i = 0; i < left; i++, x += colW) first.push({ x, y: (topH - SMALL.h) / 2, ...SMALL });
  for (let i = 0; i < bigs; i++, x += BIG.w + GAP) first.push({ x, y: 0, ...BIG });
  for (let i = left; i < beside; i++, x += colW) first.push({ x, y: (topH - SMALL.h) / 2, ...SMALL });
  const width = Math.max(x - GAP, perRow * colW - GAP);
  const inset = (width - (x - GAP)) / 2;
  for (const s of first) s.x += inset;
  const rest = [];
  const left2 = smalls - beside;
  const rows = Math.ceil(left2 / perRow);
  for (let r = 0; r < rows; r++) {
    const count = Math.min(perRow, left2 - r * perRow);
    const pad = (width - (count * colW - GAP)) / 2;
    for (let i = 0; i < count; i++) rest.push({ x: pad + i * colW, y: (first.length ? topH + GAP : 0) + r * rowH, ...SMALL });
  }
  const all = [...first, ...rest];
  const big = all.filter((s) => s.h === 9);
  const small = all.filter((s) => s.h === 6);
  return sizes.map((size) => (size === 9 ? big.shift() : small.shift()));
}

if (args.includes("--older")) {
  const packs = await rest("products?slug=like.*-poster-pack&select=id,slug,tags,pack_sizes,pack_items&limit=100");
  let done = 0;
  for (const [n, pack] of packs.entries()) {
    const spots = packSpots(pack.pack_sizes.length ? pack.pack_sizes : pack.pack_items.map(() => 6));
    const width = Math.max(...spots.map((s) => s.x + s.w));
    const height = Math.max(...spots.map((s) => s.y + s.h));
    const scale = 92 / Math.max(width, height);
    const ox = (100 - width * scale) / 2;
    const oy = (100 - height * scale) / 2;
    const round = (v) => Math.round(v * 100) / 100;
    const places = spots.map((s) => [ox + s.x * scale, oy + s.y * scale, s.w * scale, s.h * scale].map(round).join(",")).join(";");
    const { paint } = paintFor(THEMES[n % THEMES.length].id, n);
    const tags = [
      ...pack.tags.filter((t) => !/^wall (setup$|size:|paint:|spots:)/.test(t)),
      "wall setup",
      `wall size:${(width / 12).toFixed(1)} × ${(height / 12).toFixed(1)} ft`,
      `wall paint:${paint.join(",")}`,
      `wall spots:${places}`,
    ];
    await rest(`products?id=eq.${pack.id}`, { method: "PATCH", body: JSON.stringify({ tags }) });
    done++;
  }
  console.log(`✓ ${done} older packs now show as walls (pictures unchanged)`);
}

// One sheet of all of them, to compare.
if (results.length) {
  const cols = 3;
  const cw = 640;
  const ch = 640;
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
