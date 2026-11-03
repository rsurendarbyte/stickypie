// Reel Studio (http://localhost:8766): a page to make wall pack reels without the
// terminal. Pick packs and a style, press Make, watch it, play and download.
// It runs scripts/pack-reel/reel.py one reel at a time and serves the videos from
// prod_stickers/poster-packs/reels/. Only reachable from this Mac.
//
//   node scripts/pack-reel/studio.mjs     (or launch.json "reel-studio")
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const REELS = path.join(ROOT, "prod_stickers/poster-packs/reels");
const PORT = 8766;
const THEMES = ["classic", "night", "beforeafter", "onebyone", "zoom", "scatter", "polaroid", "quickcuts", "flip", "rows"];
const SLUG = /^[a-z0-9-]+-poster-pack$/;

fs.mkdirSync(REELS, { recursive: true });

// The live shop's packs (read-only, public key — the same list the shop shows).
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, "apps/web/.env.prod"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, "")])
);
async function packs() {
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?slug=like.*-poster-pack&is_active=eq.true&select=slug,name,price,thumb_url,pack_items&order=name`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`shop said ${res.status}`);
  return (await res.json()).map((p) => ({
    slug: p.slug,
    name: p.name.replace(/\s+—\s+\d+\s+Mini Poster Pack$/, ""),
    price: p.price,
    thumb: p.thumb_url,
    posters: p.pack_items?.length ?? 0,
  }));
}

const fileName = (slug, theme) => (theme === "classic" ? slug : `${slug}-${theme}`);

// One reel at a time; the rest wait in the queue.
const jobs = []; // {id, slug, theme, state: waiting|making|done|failed, log, file, started, finished}
let nextId = 1;
let busy = false;
function runNext() {
  if (busy) return;
  const job = jobs.find((j) => j.state === "waiting");
  if (!job) return;
  busy = true;
  job.state = "making";
  job.started = Date.now();
  const child = spawn("python3", [path.join(HERE, "reel.py"), job.slug, `--theme=${job.theme}`], { cwd: ROOT });
  const onData = (d) => (job.log = (job.log + d.toString()).slice(-4000));
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("close", (code) => {
    job.finished = Date.now();
    const name = fileName(job.slug, job.theme);
    job.state = code === 0 && fs.existsSync(path.join(REELS, `${name}.mp4`)) ? "done" : "failed";
    if (job.state === "done") job.file = name;
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

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        return send(res, 200, fs.readFileSync(path.join(HERE, "studio.html")), "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/api/packs") return send(res, 200, await packs());
      if (req.method === "GET" && url.pathname === "/api/reels") {
        const list = fs
          .readdirSync(REELS)
          .filter((f) => f.endsWith(".mp4"))
          .map((f) => {
            const file = f.replace(/\.mp4$/, "");
            return { file, made: fs.statSync(path.join(REELS, f)).mtimeMs, caption: fs.existsSync(path.join(REELS, `${file}-caption.txt`)) };
          });
        return send(res, 200, list);
      }
      if (req.method === "GET" && url.pathname === "/api/jobs") return send(res, 200, jobs.slice(-60));
      if (req.method === "POST" && url.pathname === "/api/make") {
        let body = "";
        for await (const c of req) body += c;
        const { slugs, theme } = JSON.parse(body || "{}");
        if (!THEMES.includes(theme)) return send(res, 400, { error: "unknown style" });
        const ok = (Array.isArray(slugs) ? slugs : []).filter((s) => SLUG.test(s));
        if (!ok.length) return send(res, 400, { error: "pick at least one pack" });
        for (const slug of ok) jobs.push({ id: nextId++, slug, theme, state: "waiting", log: "" });
        runNext();
        return send(res, 200, { queued: ok.length });
      }
      // (Re)write a reel's Instagram caption without making the video again.
      if (req.method === "POST" && url.pathname === "/api/caption") {
        let body = "";
        for await (const c of req) body += c;
        const { file } = JSON.parse(body || "{}");
        const theme = THEMES.find((th) => th !== "classic" && file?.endsWith(`-${th}`)) ?? "classic";
        const slug = theme === "classic" ? file : file?.slice(0, -(theme.length + 1));
        if (!SLUG.test(slug ?? "")) return send(res, 400, { error: "unknown reel" });
        const code = await new Promise((done) =>
          spawn("python3", [path.join(HERE, "reel.py"), slug, `--theme=${theme}`, "--caption-only"], { cwd: ROOT }).on("close", done)
        );
        const txt = path.join(REELS, `${fileName(slug, theme)}-caption.txt`);
        if (code !== 0 || !fs.existsSync(txt)) return send(res, 500, { error: "could not write the caption" });
        return send(res, 200, { caption: fs.readFileSync(txt, "utf8") });
      }
      // /reels/<name>.mp4 | -cover.jpg | -caption.txt   (?download=1 to save it)
      const m = url.pathname.match(/^\/reels\/([a-z0-9-]+)(\.mp4|-cover\.jpg|-caption\.txt)$/);
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
  .listen(PORT, "127.0.0.1", () => console.log(`Reel Studio: http://localhost:${PORT}`));
