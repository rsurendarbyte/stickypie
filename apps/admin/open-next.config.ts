import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every admin page is dynamic (behind a login), so no incremental cache.
export default defineCloudflareConfig({});
