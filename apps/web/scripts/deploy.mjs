// Build + deploy the storefront for one environment.
//
//   node scripts/deploy.mjs dev                 → dev.stickypie.in (noindex)
//   node scripts/deploy.mjs production          → stickypie.in (indexed)
//   add --build-only to stop after the build, or --preview to run it locally
//
// Prerendered pages bake SEO settings (robots meta, canonical URLs) in at
// build time, so the build must see the same SITE_ENV / SITE_URL the Worker
// gets at runtime. This script copies the environment's `vars` from
// wrangler.jsonc into the build so the two can never drift apart.
//
// Stop `npm run dev` first — the dev server and the build share `.next/`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [target, ...flags] = process.argv.slice(2);
const ENVS = { dev: null, production: "production" };

if (!(target in ENVS)) {
  console.error("Usage: node scripts/deploy.mjs <dev|production> [--build-only|--preview]");
  process.exit(1);
}
const wranglerEnv = ENVS[target];
const envArgs = wranglerEnv ? ["--env", wranglerEnv] : [];

/** Strip // and /* *\/ comments outside of strings (URLs contain "//"). */
function stripJsonComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i];
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const config = JSON.parse(
  stripJsonComments(fs.readFileSync(path.join(appDir, "wrangler.jsonc"), "utf8"))
);
const vars = (wranglerEnv ? config.env?.[wranglerEnv]?.vars : config.vars) ?? {};
if (!vars.SITE_ENV || !vars.SITE_URL) {
  console.error(`wrangler.jsonc: vars for "${target}" must define SITE_ENV and SITE_URL.`);
  process.exit(1);
}

const indexable = vars.SITE_ENV === "production";
console.log(
  `\n▶ ${target}: ${vars.SITE_URL} — search indexing ${indexable ? "ENABLED" : "DISABLED (noindex)"}\n`
);

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, ...vars },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["opennextjs-cloudflare", "build", ...envArgs]);
run("node", ["scripts/copy-static-pages.mjs"]);

// Static assets bypass the Worker, so their noindex header comes from
// Cloudflare's `_headers` file rather than next.config.
const headersFile = path.join(appDir, ".open-next/assets/_headers");
const NOINDEX_RULE = "/*\n  X-Robots-Tag: noindex, nofollow, noimageindex\n";
if (indexable) {
  fs.rmSync(headersFile, { force: true });
} else {
  fs.writeFileSync(headersFile, NOINDEX_RULE);
  console.log("deploy: wrote noindex _headers for static assets");
}

if (flags.includes("--build-only")) process.exit(0);
run("npx", ["opennextjs-cloudflare", flags.includes("--preview") ? "preview" : "deploy", ...envArgs]);
