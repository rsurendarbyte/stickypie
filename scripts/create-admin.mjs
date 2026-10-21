// Creates (or finds) a Supabase Auth user and grants them admin-console
// access — the CLI replacement for the dashboard's "Add user" + make-admin.sql.
//
//   npm run admin:create -- you@example.com
//
// The password is asked interactively with hidden input; it goes straight to
// the Supabase Admin API and is never stored or printed. Idempotent: an
// existing user just gets (re-)granted admin access.
//
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment, falling
// back to apps/web/.env.local.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(root, "apps/web/.env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const env = loadEnv();
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local)");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

function promptHidden(label) {
  process.stdout.write(label);
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = Boolean(stdin.isRaw);
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          stdin.off("data", onData);
          stdin.setRawMode?.(wasRaw);
          stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:create -- you@example.com");
  process.exit(1);
}

// 1. Find or create the auth user.
const listRes = await fetch(`${URL_}/auth/v1/admin/users?per_page=1000`, { headers });
if (!listRes.ok) {
  console.error(`Could not list users (${listRes.status}):`, (await listRes.text()).slice(0, 200));
  process.exit(1);
}
const listData = await listRes.json();
let user = (listData.users ?? listData).find(
  (u) => (u.email ?? "").toLowerCase() === email
);

if (user) {
  console.log(`User ${email} already exists — granting admin access.`);
} else {
  const password = await promptHidden(`Choose a password for ${email} (hidden): `);
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const confirm = await promptHidden("Type it again to confirm: ");
  if (password !== confirm) {
    console.error("Passwords did not match — nothing was created. Run the command again.");
    process.exit(1);
  }
  const createRes = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    console.error(`Could not create user (${createRes.status}):`, JSON.stringify(created).slice(0, 200));
    process.exit(1);
  }
  user = created;
  console.log(`Created auth user ${email}.`);
}

// 2. Grant admin-console access (idempotent).
const grantRes = await fetch(`${URL_}/rest/v1/admin_users?on_conflict=user_id`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=ignore-duplicates" },
  body: JSON.stringify([{ user_id: user.id }]),
});
if (!grantRes.ok) {
  console.error(`Could not grant admin access (${grantRes.status}):`, (await grantRes.text()).slice(0, 200));
  process.exit(1);
}

console.log(`✔ ${email} can now sign in to the admin console (http://localhost:3100).`);
