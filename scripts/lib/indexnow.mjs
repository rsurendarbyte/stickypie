// Tells Bing (whose index ChatGPT search and Copilot use) and the other IndexNow
// engines about new or changed shop pages straight away, without waiting for a
// deploy or the next crawl. Production only; never fatal. The key is public by
// design: it is the <key>.txt file in apps/web/public (deploy.mjs uses it too).
import fs from "node:fs";
import path from "node:path";
import { root } from "./target-env.mjs";

const SITE = "https://stickypie.in";

/** paths like "/sticker/chase-the-sun-desert-highway-mini-poster" */
export async function pingIndexNow(paths) {
  if (!paths.length) return;
  try {
    const keyFile = fs.readdirSync(path.join(root, "apps/web/public")).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
    if (!keyFile) return console.log("IndexNow: no key file, skipped");
    const key = keyFile.replace(/\.txt$/, "");
    const urlList = paths.map((p) => `${SITE}${p}`);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${key}.txt`, urlList }),
    });
    console.log(`IndexNow ${res.ok ? "accepted" : `answered ${res.status}`} for ${urlList.length} page(s)`);
  } catch (err) {
    console.log("IndexNow skipped:", err instanceof Error ? err.message : err);
  }
}
