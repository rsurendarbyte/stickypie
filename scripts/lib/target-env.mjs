// Shared by the CLI scripts: pick the database a command targets.
//
//   (default)  dev        → apps/web/.env.local
//   --prod     production → apps/web/.env.prod
//
// Values from the target file win over the shell environment, so a stray
// exported SUPABASE_URL can never point a command at the wrong database.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadTargetEnv() {
  const prod = process.argv.includes("--prod");
  const args = process.argv.slice(2).filter((arg) => arg !== "--prod");
  const file = path.join(root, prod ? "apps/web/.env.prod" : "apps/web/.env.local");

  const env = { ...process.env };
  if (!fs.existsSync(file)) {
    console.error(`Missing ${path.relative(root, file)} — create it first (see docs/DEPLOYMENT.md).`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) env[m[1]] = m[2].trim();
  }

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${path.relative(root, file)}`);
    process.exit(1);
  }
  const ref = new URL(url).hostname.split(".")[0];
  console.log(`Target: ${prod ? "PRODUCTION" : "dev"} database (${ref})`);
  return { env, prod, args, url, key, ref };
}

export function promptHidden(label) {
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
