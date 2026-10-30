// Used by the deploy scripts (apps/web, apps/admin): applies any pending SQL
// migrations to the target database before building, so code and database
// always go out together. Same command as `npm run db:apply [-- --prod]`; a
// migration that's already applied is skipped, so this is a no-op most days.
//
// The deploy stops if this fails (e.g. an expired SUPABASE_ACCESS_TOKEN in
// .env.ops) — new code must never go live against a database it doesn't fit.
// To deploy anyway, when you've applied them some other way:
//   SKIP_MIGRATIONS=1 npm run deploy:prod   (or --skip-migrations on the script itself)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Applies pending migrations to prod (or dev). Exits the process if they can't be applied. */
export function migrateBeforeDeploy({ prod, flags }) {
  if (flags.includes("--skip-migrations") || process.env.SKIP_MIGRATIONS === "1") {
    console.log("⚠ Skipping migrations: not checking the database for pending ones.\n");
    return;
  }
  console.log(`▶ Database migrations (${prod ? "production" : "dev"})`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts/db-apply.mjs"), ...(prod ? ["--prod"] : [])], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(
      "\n✘ Deploy stopped: the database migrations couldn't be applied, so nothing was deployed.\n" +
        "  If it says \"Invalid access token\": make a new token (supabase.com → Account → Access Tokens),\n" +
        "  put it in .env.ops as SUPABASE_ACCESS_TOKEN, and deploy again.\n" +
        "  Applied them another way (SQL editor)? Deploy with SKIP_MIGRATIONS=1 in front of the command.\n"
    );
    process.exit(1);
  }
  console.log("");
}
