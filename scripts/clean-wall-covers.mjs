// Finds wall pictures nothing uses any more: each redraw uploads a new picture
// under a new key (the cache is immutable) and leaves the old one behind. Redraws
// don't delete it themselves: dev and production share the bucket, so only a look
// at both databases shows a picture is unused, and pages cached for 10 minutes
// still point at the old file.
//
//   node scripts/clean-wall-covers.mjs            → lists them, deletes nothing
//   node scripts/clean-wall-covers.mjs --delete   → deletes that list
//
// A picture stays if any product, order, cart or setting in either database names
// it, or if it is under a day old. The list is written to
// prod_stickers/wall-setups/old-covers.txt. Deleting can't be undone.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/admin/package.json"));
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const KEEP_DAYS = 1;
const TABLES = ["products", "order_items", "orders", "carts", "categories", "store_settings"];
const LIST = path.join(root, "prod_stickers/wall-setups/old-covers.txt");
const isCover = (key) => key.startsWith("packs/") || /^(thumbs|display)\/.*wall-setup/.test(key);

const readEnv = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(path.join(root, file), "utf8")
      .split("\n")
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()])
  );

/** Every picture key a database names. Any failed read stops the script: a partial look could delete a picture in use. */
async function keysIn(envFile) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = readEnv(envFile);
  if (!url || !key) throw new Error(`Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const keys = new Set();
  for (const table of TABLES) {
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1000&offset=${from}`, { headers });
      if (!res.ok) throw new Error(`${envFile} ${table}: ${res.status} ${await res.text()}`);
      const rows = await res.json();
      for (const [found] of JSON.stringify(rows).matchAll(/(packs|thumbs|display)\/[^"\\\s,)]+/g)) keys.add(found);
      if (rows.length < 1000) break;
    }
  }
  return keys;
}

const r2Env = readEnv("apps/admin/.env.local");
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${r2Env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2Env.R2_ACCESS_KEY_ID, secretAccessKey: r2Env.R2_SECRET_ACCESS_KEY },
});

const used = new Set([...(await keysIn("apps/web/.env.local")), ...(await keysIn("apps/web/.env.prod"))]);
const objects = [];
let token;
do {
  const page = await r2.send(new ListObjectsV2Command({ Bucket: r2Env.R2_BUCKET, ContinuationToken: token }));
  objects.push(...(page.Contents ?? []));
  token = page.NextContinuationToken;
} while (token);

const covers = objects.filter((o) => isCover(o.Key));
const cutoff = Date.now() - KEEP_DAYS * 86400000;
const unused = covers.filter((o) => !used.has(o.Key));
const old = unused.filter((o) => o.LastModified.getTime() < cutoff);
const mb = (list) => `${(list.reduce((sum, o) => sum + o.Size, 0) / 1048576).toFixed(1)} MB`;

fs.writeFileSync(LIST, old.map((o) => o.Key).join("\n") + "\n");
console.log(`Wall pictures: ${covers.length} (${mb(covers)})`);
console.log(`In use, kept: ${covers.length - unused.length} (${mb(covers.filter((o) => used.has(o.Key)))})`);
console.log(`Unused but new, kept: ${unused.length - old.length} (${mb(unused.filter((o) => !old.includes(o)))})`);
console.log(`Old and unused: ${old.length} (${mb(old)}), listed in ${path.relative(root, LIST)}`);

if (process.argv.includes("--delete")) {
  for (let i = 0; i < old.length; i += 1000) {
    const Objects = old.slice(i, i + 1000).map((o) => ({ Key: o.Key }));
    const res = await r2.send(new DeleteObjectsCommand({ Bucket: r2Env.R2_BUCKET, Delete: { Objects } }));
    if (res.Errors?.length) throw new Error(`Delete stopped: ${res.Errors[0].Key} ${res.Errors[0].Message}`);
  }
  console.log(`Deleted ${old.length}.`);
}
