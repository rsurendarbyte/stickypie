// Build + deploy the admin console to Cloudflare — PRODUCTION ONLY.
//
//   node scripts/deploy.mjs                → stickypie-admin.<subdomain>.workers.dev
//   add --build-only to stop after the build, or --preview to run it locally
//
// Settings come from the same files `npm run admin:prod` uses:
// .env.production.local (production database), with anything it doesn't set
// (the R2_* image keys) taken from .env.local. Public values live in
// wrangler.jsonc `vars`; the rest are pushed to the Worker as secrets.
//
// Stop `npm run dev:admin` first — the dev server and the build share `.next/`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const flags = process.argv.slice(2);

const SECRETS = [
  "SUPABASE_ANON_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
];

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

function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) env[m[1]] = m[2].trim();
  }
  return env;
}

const config = JSON.parse(stripJsonComments(fs.readFileSync(path.join(appDir, "wrangler.jsonc"), "utf8")));
const vars = config.vars ?? {};

const prodFile = path.join(appDir, ".env.production.local");
if (!fs.existsSync(prodFile)) {
  console.error("Missing apps/admin/.env.production.local (production Supabase settings).");
  process.exit(1);
}
const fileEnv = { ...readEnvFile(path.join(appDir, ".env.local")), ...readEnvFile(prodFile) };
if (fileEnv.SUPABASE_URL !== vars.SUPABASE_URL) {
  console.error(
    "SUPABASE_URL differs between apps/admin/.env.production.local and wrangler.jsonc — fix one so the admin talks to the production database."
  );
  process.exit(1);
}
const missing = SECRETS.filter((key) => !fileEnv[key]);
if (missing.length) {
  console.error(`apps/admin env files are missing: ${missing.join(", ")}`);
  process.exit(1);
}
const secrets = Object.fromEntries(SECRETS.map((key) => [key, fileEnv[key]]));

console.log("\n▶ admin (production database) — noindex, workers.dev only\n");

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, ...secrets, ...vars, ...extraEnv },
  });
  return result.status ?? 1;
}

// OpenNext copies .env* files into the Worker bundle as fallback values, which
// would ship secrets inside the code (and the dev database settings). Move them
// aside while building; the build gets what it needs from `secrets` + `vars`.
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
    console.error(`Found ${stashDirOf(dir)} from an interrupted deploy — move its files back into ${dir} first.`);
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
const devVars = path.join(appDir, ".dev.vars");
process.on("SIGINT", () => {
  restoreEnvFiles();
  fs.rmSync(devVars, { force: true });
  process.exit(130);
});

let status;
try {
  status = run("npx", ["opennextjs-cloudflare", "build"], { NODE_ENV: "production" });
} finally {
  restoreEnvFiles();
}
if (status !== 0) process.exit(status);

const bundledEnv = path.join(appDir, ".open-next/cloudflare/next-env.mjs");
if (fs.existsSync(bundledEnv) && /"[A-Z0-9_]+"\s*:/.test(fs.readFileSync(bundledEnv, "utf8"))) {
  console.error("deploy: env values were bundled into the Worker — aborting.");
  process.exit(1);
}

// Static assets bypass the Worker, so their noindex header comes from `_headers`.
fs.writeFileSync(
  path.join(appDir, ".open-next/assets/_headers"),
  "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n"
);

if (flags.includes("--build-only")) process.exit(0);

if (flags.includes("--preview")) {
  // The local preview reads secrets from .dev.vars (gitignored); removed afterwards.
  fs.writeFileSync(devVars, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  try {
    status = run("npx", ["opennextjs-cloudflare", "preview"]);
  } finally {
    fs.rmSync(devVars, { force: true });
  }
  process.exit(status);
}

status = run("npx", ["opennextjs-cloudflare", "deploy"]);
if (status !== 0) process.exit(status);

// Push the secrets (values go through stdin, never the command line).
const bulk = spawnSync("npx", ["wrangler", "secret", "bulk"], {
  cwd: appDir,
  input: JSON.stringify(secrets),
  stdio: ["pipe", "inherit", "inherit"],
});
if (bulk.status !== 0) {
  console.error("deploy: could not set the Worker secrets.");
  process.exit(bulk.status ?? 1);
}
console.log("\n✔ admin deployed. Make sure Cloudflare Access is on for its workers.dev address.");
