import type { NextConfig } from "next";

const isProductionSite = process.env.SITE_ENV === "production";

const nextConfig: NextConfig = {
  transpilePackages: ["@stickypie/shared"],
  // Non-production sites (dev.stickypie.in, previews, local) send noindex on
  // every Worker-rendered response. Prerendered pages served as static assets
  // get the same header from the `_headers` file written by scripts/deploy.mjs.
  // Any wall set can be customized on its own page now.
  async redirects() {
    return [{ source: "/wall-builder", destination: "/stickers/poster-packs", permanent: true }];
  },
  async headers() {
    if (isProductionSite) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" }],
      },
    ];
  },
};

export default nextConfig;
