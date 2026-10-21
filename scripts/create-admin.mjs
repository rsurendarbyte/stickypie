// Creates (or finds) a Supabase Auth user and grants them admin-console
// access — the CLI replacement for the dashboard's "Add user" + make-admin.sql.
//
//   npm run admin:create -- you@example.com           (dev database)
//   npm run admin:create -- you@example.com --prod    (production database)
//
// The password is asked interactively with hidden input; it goes straight to
// the Supabase Admin API and is never stored or printed. Idempotent: an
// existing user just gets (re-)granted admin access.
import { loadTargetEnv, promptHidden } from "./lib/target-env.mjs";

const { args, url: URL_, key: KEY } = loadTargetEnv();

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const email = (args[0] ?? "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:create -- you@example.com [--prod]");
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
