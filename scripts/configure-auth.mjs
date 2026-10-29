// Configures shopper emails for dev AND production:
//   Supabase (each project):
//     - Site URL + allowed reset-link addresses for that environment
//     - Resend as the SMTP sender (Supabase's built-in mailer can't reach customers)
//     - The StickyPie-branded "reset your password" email (packages/shared/src/emails.ts)
//     - Public sign-up off: accounts are only created by the shop's /api/account/signup
//       (which confirms them instantly and sends the welcome email)
//   Cloudflare (each storefront Worker):
//     - RESEND_API_KEY secret, so the shop can send its own emails (sign-up code, contact)
//     - BREVO_API_KEY secret (optional): the backup sender when Resend refuses,
//       e.g. after its 100 free emails a day
//
//   npm run auth:configure              (apply)
//   npm run auth:configure -- --dry-run (show what would change, no secrets printed)
//
// Reads RESEND_API_KEY, SUPABASE_ACCESS_TOKEN, EMAIL_FROM_* and optional
// BREVO_API_KEY from .env.ops (gitignored).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resetPasswordEmail } from "../packages/shared/src/emails.ts";
import { SHOP_THEME } from "../packages/shared/src/theme.ts";
import { root } from "./lib/target-env.mjs";

const SUPPORT_EMAIL = "hello@clodot.com";

function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) env[m[1]] = m[2].trim();
  }
  return env;
}

const ops = readEnv(path.join(root, ".env.ops"));
const dryRun = process.argv.includes("--dry-run");
for (const key of ["RESEND_API_KEY", "SUPABASE_ACCESS_TOKEN", "EMAIL_FROM_ADDRESS"]) {
  if (!ops[key] && !(dryRun && key !== "EMAIL_FROM_ADDRESS")) {
    console.error(`.env.ops is missing ${key}`);
    process.exit(1);
  }
}

const refOf = (file) => {
  const url = readEnv(path.join(root, file)).SUPABASE_URL;
  if (!url) throw new Error(`${file} has no SUPABASE_URL`);
  return new URL(url).hostname.split(".")[0];
};

const TARGETS = [
  {
    name: "dev",
    wranglerEnv: null,
    ref: refOf("apps/web/.env.local"),
    siteUrl: "https://dev.stickypie.in",
    redirects: ["https://dev.stickypie.in/account/reset", "http://localhost:3000/account/reset"],
  },
  {
    name: "PRODUCTION",
    wranglerEnv: "production",
    ref: refOf("apps/web/.env.prod"),
    siteUrl: "https://stickypie.in",
    redirects: ["https://stickypie.in/account/reset"],
  },
];

for (const target of TARGETS) {
  const reset = resetPasswordEmail({ siteUrl: target.siteUrl, supportEmail: SUPPORT_EMAIL, colors: SHOP_THEME });
  const config = {
    site_url: target.siteUrl,
    uri_allow_list: target.redirects.join(","),
    external_email_enabled: true,
    disable_signup: true,
    smtp_admin_email: ops.EMAIL_FROM_ADDRESS,
    smtp_sender_name: ops.EMAIL_FROM_NAME || "StickyPie",
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: ops.RESEND_API_KEY,
    // Supabase keeps its built-in mailer's limit (2 emails/hour for the whole
    // project) even after switching to SMTP — far too low for real shoppers.
    rate_limit_email_sent: 60,
    smtp_max_frequency: 60,
    mailer_subjects_recovery: reset.subject,
    mailer_templates_recovery_content: reset.html,
  };

  console.log(`\n${target.name} (${target.ref})`);
  console.log(`  site URL      ${config.site_url}`);
  console.log(`  reset links   ${target.redirects.join("  ")}`);
  console.log(`  sender        ${config.smtp_sender_name} <${config.smtp_admin_email}> via Resend`);
  console.log(`  emails        "${reset.subject}" (Supabase, via Resend) · shop emails (Resend${ops.BREVO_API_KEY ? ", Brevo as backup" : ""})`);
  console.log(`  public signup off — accounts only via the shop's checkout / account page`);
  if (dryRun) continue;

  // The shop's own emails are sent by the storefront Worker itself (Resend, then Brevo).
  for (const name of ["RESEND_API_KEY", "BREVO_API_KEY"]) {
    if (!ops[name]) {
      console.log(`  – ${name} not in .env.ops, skipped`);
      continue;
    }
    const secret = spawnSync(
      "npx",
      ["wrangler", "secret", "put", name, ...(target.wranglerEnv ? ["--env", target.wranglerEnv] : [])],
      { cwd: path.join(root, "apps/web"), input: ops[name], encoding: "utf8" }
    );
    console.log(
      secret.status === 0
        ? `  ✔ ${name} set on the storefront Worker`
        : `  ✘ could not set ${name}: ${(secret.stderr || secret.stdout).slice(-200)}`
    );
    if (secret.status !== 0) process.exitCode = 1;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${target.ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ops.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✘ ${res.status}: ${text.slice(0, 300)}`);
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.error("    The access token must belong to the Supabase account that owns this project.");
    }
    process.exitCode = 1;
    continue;
  }
  const saved = await res.json();
  const ok =
    saved.site_url === config.site_url &&
    saved.smtp_host === config.smtp_host &&
    saved.smtp_admin_email === config.smtp_admin_email;
  console.log(ok ? "  ✔ saved" : "  ⚠ saved, but the read-back differs — check the dashboard");
}

if (dryRun) console.log("\n(dry run — nothing was changed)");
