// OpenNext → Cloudflare Workers adapter config.
// Defaults are fine for this app: every data page is force-dynamic SSR, so no
// ISR/incremental cache is needed (keeps us comfortably inside the free plan).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
