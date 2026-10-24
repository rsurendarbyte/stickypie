// Post-build step for Cloudflare deploys: node scripts/copy-static-pages.mjs <target>
//
// 1. Pages. @opennextjs/cloudflare serves prerendered pages from inside the
//    Worker, which counts every page view against the free plan's 100,000
//    requests a day and its CPU limit. Copying the prerendered HTML into
//    `.open-next/assets/` makes Cloudflare serve them as STATIC ASSETS
//    instead: unlimited and free. Shop links are plain page loads
//    (components/page-link.tsx), so nothing needs the Worker's in-app
//    navigation (RSC) answers. The Worker still handles checkout, payments,
//    orders, the API, and sticker pages added after the last deploy.
// 2. Fixed files built by route handlers (robots.txt, sitemap.xml, llms.txt,
//    the Google feed) — also served as static assets.
// 3. The previous deploys' JS/CSS files are kept next to the new ones, so a
//    tab still open from before a deploy loads them as free static files
//    instead of falling through to the Worker as "not found".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("Usage: copy-static-pages.mjs <target>");
  process.exit(1);
}

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(appDir, ".next/server/app");
const assetsDir = path.join(appDir, ".open-next/assets");

if (!fs.existsSync(sourceDir) || !fs.existsSync(assetsDir)) {
  console.error("Run `opennextjs-cloudflare build` before copy-static-pages.");
  process.exit(1);
}

// Dynamic routes must keep hitting the Worker — never ship them as assets.
const SKIP = new Set(["_not-found.html", "_global-error.html"]);
const SKIP_PREFIXES = ["order/", "pay/", "api/"];

function copy(from, rel) {
  const dest = path.join(assetsDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
}

let pages = 0;
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(sourceDir, abs);
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    if (SKIP.has(rel) || SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue;
    if (entry.name.endsWith(".html")) {
      copy(abs, rel);
      pages++;
    } else if (entry.name.endsWith(".body")) {
      // A route handler's prerendered response; only plain 200 answers
      // (e.g. not the dev site's "Not found" feed).
      const meta = abs.replace(/\.body$/, ".meta");
      const status = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, "utf8")).status : undefined;
      if (status && status !== 200) continue;
      const name = rel.replace(/\.body$/, "");
      copy(abs, name);
      files.push(name);
    }
  }
}
walk(sourceDir);
console.log(`copy-static-pages: ${pages} pages + ${files.join(", ") || "no files"} → static assets (served free & unlimited)`);

// Keep earlier deploys' JS/CSS. Each deploy's files are saved per build id
// (gitignored); the last KEEP builds are merged back in.
const KEEP = 3;
const historyDir = path.join(appDir, ".static-history", target);
const buildId = fs.readFileSync(path.join(appDir, ".next/BUILD_ID"), "utf8").trim();
const staticDir = path.join(assetsDir, "_next/static");
const previous = fs.existsSync(historyDir)
  ? fs
      .readdirSync(historyDir)
      .filter((d) => d !== buildId)
      .map((d) => ({ d, t: fs.statSync(path.join(historyDir, d)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
  : [];
let restored = 0;
for (const { d } of previous.slice(0, KEEP)) {
  const from = path.join(historyDir, d);
  for (const rel of fs.readdirSync(from, { recursive: true })) {
    const src = path.join(from, rel);
    const dest = path.join(staticDir, rel);
    if (fs.statSync(src).isDirectory() || fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    restored++;
  }
}
for (const { d } of previous.slice(KEEP)) fs.rmSync(path.join(historyDir, d), { recursive: true, force: true });
// Save this build's own files (not the restored ones) for the next deploy.
fs.rmSync(path.join(historyDir, buildId), { recursive: true, force: true });
fs.cpSync(path.join(appDir, ".next/static"), path.join(historyDir, buildId), { recursive: true });
console.log(`copy-static-pages: kept ${restored} JS/CSS files from the last ${Math.min(KEEP, previous.length)} deploy(s)`);
