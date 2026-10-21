// Applies supabase/migrations/* to a database — schema only, never seed data.
//
//   npm run db:push            (dev database)
//   npm run db:push:prod       (production database)
//
// A database whose schema was created outside this tool (e.g. SQL pasted in
// the dashboard) has no migration history, so push would re-run old files and
// fail with "already exists". Record those versions as applied first:
//   npm run db:push -- --mark-applied 20261020000001
//
// Needs the project's DATABASE password (Supabase dashboard → Project
// Settings → Database). It's asked with hidden input and passed straight to
// the Supabase CLI; it is never stored or printed. Safe to re-run: only
// migrations the database hasn't seen yet are applied.
import { spawnSync } from "node:child_process";
import { loadTargetEnv, promptHidden, root } from "./lib/target-env.mjs";

const { ref, prod, args } = loadTargetEnv();

const markIndex = args.indexOf("--mark-applied");
const markApplied = markIndex >= 0 ? args.slice(markIndex + 1).filter((a) => /^\d{14}$/.test(a)) : [];
if (markIndex >= 0 && markApplied.length === 0) {
  console.error("--mark-applied needs one or more migration versions, e.g. 20261020000001");
  process.exit(1);
}

const password = await promptHidden(`Database password for ${ref} (hidden): `);
if (!password) {
  console.error("No password entered — nothing was changed.");
  process.exit(1);
}

const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;

if (markApplied.length) {
  const repair = spawnSync(
    "supabase",
    ["migration", "repair", ...markApplied, "--status", "applied", "--db-url", dbUrl],
    { cwd: root, stdio: "inherit" }
  );
  if (repair.status !== 0) process.exit(repair.status ?? 1);
  console.log(`Recorded as already applied: ${markApplied.join(", ")}`);
}

const result = spawnSync("supabase", ["db", "push", "--db-url", dbUrl], {
  cwd: root,
  stdio: "inherit",
});

if (result.status === 0) {
  console.log(`✔ ${prod ? "PRODUCTION" : "dev"} database schema is up to date (no seed data applied).`);
}
process.exit(result.status ?? 1);
