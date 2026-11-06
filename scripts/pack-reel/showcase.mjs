// Product Reel Studio (http://localhost:8767): reels for Instagram and YouTube Shorts
// that sell several products together, stickers, posters and walls, in animated styles
// or UGC templates. Pick products, press Make, play and download. It runs scripts/pack-reel/showcase.py one
// reel at a time and keeps reels in prod_stickers/product-reels/. Only reachable from this Mac.
//
//   npm run product-reels     (or launch.json "product-reel-studio")
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const REELS = path.join(ROOT, "prod_stickers/product-reels");
const CLIPS = path.join(REELS, "clips");
const PORT = 8767;
const STYLES = ["spotlight", "slap", "carousel", "swipe", "beat", "scroll", "walltour", "pov", "picks", "parcel", "thisorthat", "wishlist", "myclip"];
const SLUG = /^[a-z0-9-]+$/;
const CLIP = /^[a-z0-9-]+\.(mp4|mov|m4v|jpg|jpeg|png|webp)$/;
const MAX_CLIP = 500 * 1024 * 1024;

fs.mkdirSync(CLIPS, { recursive: true });

// The live shop (read-only, public key — the same list the shop shows).
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, "apps/web/.env.prod"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, "")])
);
const shop = async (query) => {
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`shop said ${res.status}`);
  return res.json();
};
async function products() {
  const [rows, categories] = await Promise.all([
    shop("products?is_active=eq.true&select=slug,name,price,thumb_url,pack_items,sizes,category_ids,stock&order=created_at.desc&limit=2000"),
    shop("categories?select=id,name"),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return rows
    .filter((p) => p.stock !== 0)
    .map((p) => {
      const lowest = Math.min(...(p.sizes ?? []).map((s) => s.price), p.sizes?.length ? Infinity : p.price);
      return {
        slug: p.slug,
        name: p.name.replace(/\s+[—-]\s+\d+\s+Mini Poster Pack$/, "").replace(/\s+Wall Setup$/, "").replace(/\s*[—-]?\s*Mini Poster$/, ""),
        kind: p.pack_items?.length ? "wall" : p.slug.endsWith("-mini-poster") ? "poster" : "sticker",
        price: lowest,
        thumb: p.thumb_url,
        categories: (p.category_ids ?? []).map((id) => catName.get(id)).filter(Boolean),
      };
    });
}

// One reel at a time; the rest wait in the queue.
const jobs = []; // {id, name, style, hook, slugs, prices, clip, state: waiting|making|done|failed, log, started, finished}
let nextId = 1;
let busy = false;
function runNext() {
  if (busy) return;
  const job = jobs.find((j) => j.state === "waiting");
  if (!job) return;
  busy = true;
  job.state = "making";
  job.started = Date.now();
  const args = [path.join(HERE, "showcase.py"), `--style=${job.style}`, `--name=${job.name}`, ...job.slugs];
  if (job.hook) args.push(`--hook=${job.hook}`);
  if (job.offer) args.push(`--offer=${job.offer}`);
  if (!job.prices) args.push("--no-prices");
  if (job.clip) args.push(`--clip=${path.join(CLIPS, job.clip)}`);
  if (job.times.some(Boolean)) args.push(`--times=${job.times.map((v) => v ?? "").join(",")}`);
  if (job.intro !== null) args.push(`--intro=${job.intro}`);
  if (job.end !== null) args.push(`--end=${job.end}`);
  const child = spawn("python3", args, { cwd: ROOT });
  const onData = (d) => (job.log = (job.log + d.toString()).slice(-4000));
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("close", (code) => {
    job.finished = Date.now();
    job.state = code === 0 && fs.existsSync(path.join(REELS, `${job.name}.mp4`)) ? "done" : "failed";
    busy = false;
    runNext();
  });
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// Videos with Range support, so the player can seek.
function sendFile(req, res, file, type, download) {
  const stat = fs.statSync(file);
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${path.basename(file)}"`;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  fs.createReadStream(file).pipe(res);
}

async function readJson(req) {
  let body = "";
  for await (const c of req) body += c;
  return JSON.parse(body || "{}");
}

// Seconds from the page: a number in range, or null for automatic.
const seconds = (value, low, high) => {
  const v = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(v) ? null : Math.min(high, Math.max(low, v));
};

const stamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        return send(res, 200, fs.readFileSync(path.join(HERE, "showcase.html")), "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/api/products") return send(res, 200, await products());
      if (req.method === "GET" && url.pathname === "/api/reels") {
        const list = fs
          .readdirSync(REELS)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => {
            const file = f.replace(/\.mp4$/, "");
            const info = path.join(REELS, `${file}-info.json`);
            return { file, made: fs.statSync(path.join(REELS, f)).mtimeMs, info: fs.existsSync(info) ? JSON.parse(fs.readFileSync(info, "utf8")) : null };
          });
        return send(res, 200, list);
      }
      if (req.method === "GET" && url.pathname === "/api/jobs") return send(res, 200, jobs.slice(-60));
      // Your own video or photo for the My clip template: the file itself is the request body.
      if (req.method === "POST" && url.pathname === "/api/clip") {
        const ext = (url.searchParams.get("name") ?? "").toLowerCase().match(/\.(mp4|mov|m4v|jpg|jpeg|png|webp)$/)?.[1];
        if (!ext) return send(res, 400, { error: "use an mp4, mov, jpg, png or webp file" });
        const name = `${randomUUID()}.${ext}`;
        const file = path.join(CLIPS, name);
        const out = fs.createWriteStream(file);
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_CLIP) {
            out.destroy();
            fs.rmSync(file, { force: true });
            return send(res, 413, { error: "that file is over 500 MB" });
          }
          if (!out.write(chunk)) await new Promise((go) => out.once("drain", go));
        }
        await new Promise((go) => out.end(go));
        return send(res, 200, { clip: name });
      }
      if (req.method === "POST" && url.pathname === "/api/make") {
        const { slugs, style, hook, offer, prices = true, clip, times, intro, end } = await readJson(req);
        if (!STYLES.includes(style)) return send(res, 400, { error: "unknown style" });
        const ok = (Array.isArray(slugs) ? slugs : []).filter((s) => SLUG.test(s));
        if (ok.length < 2 || ok.length > 16) return send(res, 400, { error: "pick 2 to 16 products" });
        if (style === "myclip" && !(CLIP.test(clip ?? "") && fs.existsSync(path.join(CLIPS, clip)))) return send(res, 400, { error: "add your video or photo first" });
        const id = nextId++;
        jobs.push({ id, name: `${style}-${stamp()}-${id}`, style, hook: String(hook ?? "").trim().slice(0, 90), offer: String(offer ?? "").trim().slice(0, 60), slugs: ok, prices: !!prices, clip: style === "myclip" ? clip : null, times: ok.map((_, i) => seconds(times?.[i], 0.3, 10)), intro: seconds(intro, 0, 4), end: seconds(end, 2, 10), state: "waiting", log: "" });
        runNext();
        return send(res, 200, { id });
      }
      // Delete a reel: its video, cover, caption and notes.
      if (req.method === "POST" && url.pathname === "/api/delete") {
        const { file } = await readJson(req);
        if (!SLUG.test(file ?? "")) return send(res, 400, { error: "unknown reel" });
        if (jobs.some((j) => j.name === file && (j.state === "waiting" || j.state === "making"))) return send(res, 409, { error: "this reel is being made" });
        for (const end of [".mp4", "-cover.jpg", "-caption.txt", "-shorts.txt", "-info.json"]) fs.rmSync(path.join(REELS, file + end), { force: true });
        return send(res, 200, { deleted: file });
      }
      // /reels/<name>.mp4 | -cover.jpg | -caption.txt | -shorts.txt   (?download=1 to save it)
      const m = url.pathname.match(/^\/reels\/([a-z0-9-]+)(\.mp4|-cover\.jpg|-caption\.txt|-shorts\.txt)$/);
      if (req.method === "GET" && m) {
        const file = path.join(REELS, m[1] + m[2]);
        if (!fs.existsSync(file)) return send(res, 404, "not made yet", "text/plain");
        const type = m[2] === ".mp4" ? "video/mp4" : m[2] === "-cover.jpg" ? "image/jpeg" : "text/plain; charset=utf-8";
        return sendFile(req, res, file, type, url.searchParams.has("download"));
      }
      send(res, 404, "not found", "text/plain");
    } catch (err) {
      send(res, 500, { error: String(err?.message ?? err) });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Product Reel Studio: http://localhost:${PORT}`));
