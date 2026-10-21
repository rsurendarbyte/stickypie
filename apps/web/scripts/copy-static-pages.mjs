// Post-build step for Cloudflare deploys.
//
// @opennextjs/cloudflare serves prerendered pages from inside the Worker,
// which would count every page view against the free plan's daily request
// cap. Copying the prerendered HTML into `.open-next/assets/` makes
// Cloudflare serve them as STATIC ASSETS instead: unlimited, free, and the
// Worker is only invoked for genuinely dynamic routes (checkout, orders,
// webhooks, and product pages added after the last deploy).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(appDir, ".next/server/app");
const assetsDir = path.join(appDir, ".open-next/assets");

if (!fs.existsSync(sourceDir) || !fs.existsSync(assetsDir)) {
  console.error("Run `opennextjs-cloudflare build` before copy-static-pages.");
  process.exit(1);
}

// Dynamic routes must keep hitting the Worker — never ship them as assets.
const SKIP = new Set(["_not-found.html"]);
const SKIP_PREFIXES = ["order/", "pay/", "api/"];

let copied = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(sourceDir, abs);
    if (entry.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;
    if (SKIP.has(rel) || SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue;
    const dest = path.join(assetsDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
    copied++;
  }
}

walk(sourceDir);
console.log(`copy-static-pages: ${copied} prerendered pages → static assets (served free & unlimited)`);
