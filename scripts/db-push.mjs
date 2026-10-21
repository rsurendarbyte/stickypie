// Applies supabase/migrations/* to a database — schema only, never seed data.
//
//   npm run db:push            (dev database)
//   npm run db:push:prod       (production database)
//
// Needs the project's DATABASE password (Supabase dashboard → Project
// Settings → Database). It's asked with hidden input and passed straight to
// the Supabase CLI; it is never stored or printed. Safe to re-run: only
// migrations the database hasn't seen yet are applied.
import { spawnSync } from "node:child_process";
import { loadTargetEnv, promptHidden, root } from "./lib/target-env.mjs";

const { ref, prod } = loadTargetEnv();

const password = await promptHidden(`Database password for ${ref} (hidden): `);
if (!password) {
  console.error("No password entered — nothing was changed.");
  process.exit(1);
}

const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
const result = spawnSync("supabase", ["db", "push", "--db-url", dbUrl], {
  cwd: root,
  stdio: "inherit",
});

if (result.status === 0) {
  console.log(`✔ ${prod ? "PRODUCTION" : "dev"} database schema is up to date (no seed data applied).`);
}
process.exit(result.status ?? 1);
