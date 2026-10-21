// Configures shopper emails (password reset) in BOTH Supabase projects:
//   - Site URL + allowed reset-link addresses for that environment
//   - Resend as the SMTP sender (Supabase's built-in mailer can't reach customers)
//   - A StickyPie-branded "reset your password" email
//
//   npm run auth:configure              (apply)
//   npm run auth:configure -- --dry-run (show what would change, no secrets printed)
//
// Reads RESEND_API_KEY, SUPABASE_ACCESS_TOKEN, EMAIL_FROM_* from .env.ops (gitignored).
import fs from "node:fs";
import path from "node:path";
import { root } from "./lib/target-env.mjs";

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
    ref: refOf("apps/web/.env.local"),
    siteUrl: "https://dev.stickypie.in",
    redirects: ["https://dev.stickypie.in/account/reset", "http://localhost:3000/account/reset"],
  },
  {
    name: "PRODUCTION",
    ref: refOf("apps/web/.env.prod"),
    siteUrl: "https://stickypie.in",
    redirects: ["https://stickypie.in/account/reset"],
  },
];

const RESET_EMAIL = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#15161e">
  <h2 style="margin:0 0 8px">Reset your StickyPie password</h2>
  <p style="margin:0 0 20px;color:#64708a">Someone (hopefully you) asked to reset the password for your StickyPie account. The link works once and expires soon.</p>
  <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ff2e63;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Choose a new password</a></p>
  <p style="margin:0;color:#64708a;font-size:13px">Didn't ask for this? Ignore this email — your password stays the same.</p>
</div>`;

for (const target of TARGETS) {
  const config = {
    site_url: target.siteUrl,
    uri_allow_list: target.redirects.join(","),
    external_email_enabled: true,
    smtp_admin_email: ops.EMAIL_FROM_ADDRESS,
    smtp_sender_name: ops.EMAIL_FROM_NAME || "StickyPie",
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: ops.RESEND_API_KEY,
    mailer_subjects_recovery: "Reset your StickyPie password",
    mailer_templates_recovery_content: RESET_EMAIL,
  };

  console.log(`\n${target.name} (${target.ref})`);
  console.log(`  site URL      ${config.site_url}`);
  console.log(`  reset links   ${target.redirects.join("  ")}`);
  console.log(`  sender        ${config.smtp_sender_name} <${config.smtp_admin_email}> via Resend`);
  if (dryRun) continue;

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
