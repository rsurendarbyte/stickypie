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

// Build-time data source: dev builds read .env.local (dev database); the
// production build reads .env.prod (production database). These supply the
// catalog snapshot and the browser's live catalog.
const buildEnvFile = path.join(appDir, wranglerEnv ? ".env.prod" : ".env.local");
if (!fs.existsSync(buildEnvFile)) {
  console.error(`Missing apps/web/${path.basename(buildEnvFile)} (Supabase settings for ${target}).`);
  process.exit(1);
}
const buildEnv = {};
for (const line of fs.readFileSync(buildEnvFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && m[2].trim()) buildEnv[m[1]] = m[2].trim();
}
for (const key of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (!buildEnv[key]) {
    console.error(`apps/web/${path.basename(buildEnvFile)} is missing ${key}.`);
    process.exit(1);
  }
}
if (buildEnv.SUPABASE_URL !== vars.SUPABASE_URL) {
  console.error(
    `SUPABASE_URL differs between apps/web/${path.basename(buildEnvFile)} and the ${target} vars in wrangler.jsonc — fix one so the build and the Worker use the same database.`
  );
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
    env: { ...process.env, ...buildEnv, ...vars },
  });
  return result.status ?? 1;
}

// OpenNext copies every .env* file in the app folder into the Worker bundle as
// fallback process.env values. That would ship secrets inside the code and let
// a Worker silently fall back to dev settings for anything not configured on
// it. So the env files are moved aside while building (the values the build
// needs come from `buildEnv` above), and the Worker only ever sees its own
// wrangler vars + secrets.
// OpenNext reads env files from both the app folder and the monorepo root.
const repoRoot = path.resolve(appDir, "../..");
const NEXT_ENV_FILE = /^\.env(\.(local|production|development|test)(\.local)?)?$/;
const stashed = []; // [dir, name]
const stashDirOf = (dir) => path.join(dir, ".env.deploy-stash");
function restoreEnvFiles() {
  while (stashed.length) {
    const [dir, name] = stashed.pop();
    fs.renameSync(path.join(stashDirOf(dir), name), path.join(dir, name));
  }
  for (const dir of [appDir, repoRoot]) fs.rmSync(stashDirOf(dir), { recursive: true, force: true });
}
for (const dir of [appDir, repoRoot]) {
  if (fs.existsSync(stashDirOf(dir))) {
    console.error(
      `Found ${stashDirOf(dir)} from an interrupted deploy — move its files back into ${dir} first.`
    );
    process.exit(1);
  }
}
for (const dir of [appDir, repoRoot]) {
  for (const name of fs.readdirSync(dir)) {
    if (!NEXT_ENV_FILE.test(name)) continue;
    fs.mkdirSync(stashDirOf(dir), { recursive: true });
    fs.renameSync(path.join(dir, name), path.join(stashDirOf(dir), name));
    stashed.push([dir, name]);
  }
}
process.on("SIGINT", () => {
  restoreEnvFiles();
  process.exit(130);
});

// Next keeps Supabase responses from earlier builds in its fetch cache and
// would reuse them, baking stale names/prices into prerendered pages. Every
// deploy must read the database fresh.
fs.rmSync(path.join(appDir, ".next/cache/fetch-cache"), { recursive: true, force: true });

let status;
try {
  status = run("npx", ["opennextjs-cloudflare", "build", ...envArgs]);
} finally {
  restoreEnvFiles();
}
if (status !== 0) process.exit(status);

const bundledEnv = path.join(appDir, ".open-next/cloudflare/next-env.mjs");
if (fs.existsSync(bundledEnv) && /"[A-Z0-9_]+"\s*:/.test(fs.readFileSync(bundledEnv, "utf8"))) {
  console.error("deploy: env values were bundled into the Worker — aborting.");
  process.exit(1);
}

// Pages are NOT copied out as plain static files any more: a static file
// can't answer the browser's in-app navigation (RSC) requests, which forced a
// full reload on every tap. `opennextjs-cloudflare deploy` uploads them to the
// environment's R2 page cache instead (see open-next.config.ts).

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
const preview = flags.includes("--preview");
status = run("npx", ["opennextjs-cloudflare", preview ? "preview" : "deploy", ...envArgs]);
if (status !== 0 || preview) process.exit(status);

// Nothing falls back to .env files any more, so say which secrets the
// deployed Worker is still missing.
const list = spawnSync("npx", ["wrangler", "secret", "list", "--format", "json", ...envArgs], {
  cwd: appDir,
  encoding: "utf8",
});
try {
  const have = new Set(JSON.parse(list.stdout).map((secret) => secret.name));
  const missing = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "RESEND_API_KEY",
  ].filter(
    (name) => !have.has(name)
  );
  if (missing.length) {
    console.warn(`\n⚠ ${target} Worker is missing secrets: ${missing.join(", ")}`);
    console.warn(
      `  Set each with: npx wrangler secret put <NAME>${wranglerEnv ? ` --env ${wranglerEnv}` : ""}`
    );
    console.warn("  (without the Cashfree keys, checkout on production reports payments unavailable)");
  } else {
    console.log(`✔ ${target} Worker has all its secrets.`);
  }
} catch {
  console.warn("Could not list Worker secrets — check them in the Cloudflare dashboard.");
}
