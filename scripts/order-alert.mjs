// Mac notification for every new paid order on the production shop.
// Checks the prod database once a minute (free: no outside service), and
// shows a quiet banner: no sound, nothing pops up over your work.
//
//   node scripts/order-alert.mjs --prod          keep watching (the service runs this)
//   node scripts/order-alert.mjs --prod --test   show one sample banner and stop
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { loadTargetEnv } from "./lib/target-env.mjs";

const { url, key, args } = loadTargetEnv();
const EVERY_MS = 60_000;
const STATE = path.join(os.homedir(), "Library/Logs/stickypie/order-alert.last");
const ADMIN = "http://localhost:3200/orders";

function notify(title, text) {
  const q = (s) => JSON.stringify(String(s));
  execFile("osascript", ["-e", `display notification ${q(text)} with title ${q(title)}`]);
}

if (args.includes("--test")) {
  notify("New StickyPie order · ₹248", "Sample Name · 3 stickers · Bengaluru");
  console.log("Sample banner sent.");
  process.exit(0);
}

let since = (() => {
  try {
    return fs.readFileSync(STATE, "utf8").trim() || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
})();

async function check() {
  const q = `select=id,customer_name,total,paid_at&status=neq.pending&status=neq.failed&paid_at=gt.${encodeURIComponent(since)}&order=paid_at.asc&limit=20`;
  const res = await fetch(`${url}/rest/v1/orders?${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const orders = await res.json();
  for (const o of orders) {
    notify(`New StickyPie order · ₹${o.total}`, `${o.customer_name} · open ${ADMIN}`);
    console.log(new Date().toISOString(), "order", o.id, o.total);
  }
  if (orders.length) {
    since = orders[orders.length - 1].paid_at;
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, since);
  }
}

console.log("Watching for new orders since", since);
for (;;) {
  // Offline / asleep: just try again next minute; orders paid meanwhile still show.
  await check().catch((e) => console.log(new Date().toISOString(), "check failed:", e.message));
  await new Promise((r) => setTimeout(r, EVERY_MS));
}
