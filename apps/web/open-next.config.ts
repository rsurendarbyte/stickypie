// OpenNext → Cloudflare Workers adapter config.
//
// Pages prerendered at build (home, /stickers, every sticker and category
// page, legal…) are served by the Worker from its static-assets cache: the
// built HTML *and* the RSC payload the browser needs for instant in-app
// navigation. (Shipping that HTML as plain static files instead broke client
// navigation — every tap became a full page reload.) No revalidation: data on
// those pages refreshes live in the browser and on the next deploy.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // Answer cached pages before booting the Next server — faster, less CPU.
  enableCacheInterception: true,
});
