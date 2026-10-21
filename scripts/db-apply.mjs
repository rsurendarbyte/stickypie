// Applies pending SQL migrations without the database password, through the
// Supabase Management API (SUPABASE_ACCESS_TOKEN from .env.ops):
//
//   npm run db:apply            → dev database
//   npm run db:apply -- --prod  → production database
//
// Same bookkeeping as `supabase db push`: a migration listed in
// supabase_migrations.schema_migrations is skipped, and each applied one is
// recorded there — so db:push and db:apply can be mixed freely.
import fs from "node:fs";
import path from "node:path";
import { loadTargetEnv, root } from "./lib/target-env.mjs";

const { prod, ref } = loadTargetEnv();

function readOps() {
  const file = path.join(root, ".env.ops");
  const env = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[2].trim()) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const token = readOps().SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in .env.ops (Supabase dashboard → Account → Access Tokens).");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;

const dir = path.join(root, "supabase/migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();

const applied = new Set(
  (await sql("select version from supabase_migrations.schema_migrations")).map((r) => r.version)
);
const pending = files.filter((f) => !applied.has(f.slice(0, 14)));

if (pending.length === 0) {
  console.log("✔ Nothing to apply — the database is up to date.");
  process.exit(0);
}

console.log(`Applying ${pending.length} migration(s) to ${prod ? "PRODUCTION" : "dev"}:`);
for (const file of pending) {
  const version = file.slice(0, 14);
  const name = file.slice(15, -4);
  const body = fs.readFileSync(path.join(dir, file), "utf8");
  try {
    await sql(
      `begin;\n${body}\n;insert into supabase_migrations.schema_migrations (version, name, statements) ` +
        `values (${quote(version)}, ${quote(name)}, array[${quote(body)}]) on conflict (version) do nothing;\ncommit;`
    );
    console.log(`  ✔ ${file}`);
  } catch (err) {
    console.error(`  ✘ ${file}\n    ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
console.log("✔ Done.");
