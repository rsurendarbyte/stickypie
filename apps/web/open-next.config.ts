// OpenNext → Cloudflare Workers adapter config.
//
// Page cache in R2 (bucket bound as NEXT_INC_CACHE_R2_BUCKET, one per
// environment): every deploy uploads the prerendered pages (home, /stickers,
// every sticker and category page, legal…) together with the RSC payload the
// browser needs for instant in-app navigation. A sticker added in the admin
// after the last deploy is built once on its first visit, stored in R2, and
// served from there for everyone after — no deploy needed. Pages that opt in
// with `revalidate` refresh in the background (memory queue → the Worker
// calls itself through WORKER_SELF_REFERENCE).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  // Cloudflare's edge cache in front of R2: repeat visits in a region skip R2.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: memoryQueue,
  // Answer cached pages before booting the Next server — faster, less CPU.
  enableCacheInterception: true,
});
