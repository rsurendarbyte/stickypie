import type { NextConfig } from "next";

const isProductionSite = process.env.SITE_ENV === "production";

/** Also written into the static assets' _headers file by scripts/deploy.mjs. */
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@stickypie/shared"],
  // Non-production sites (dev.stickypie.in, previews, local) send noindex on
  // every Worker-rendered response. Prerendered pages served as static assets
  // get the same header from the `_headers` file written by scripts/deploy.mjs.
  // Any wall set can be customized on its own page now.
  async redirects() {
    return [{ source: "/wall-builder", destination: "/stickers/poster-packs", permanent: true }];
  },
  // Every site: no MIME sniffing, links out send only the origin (an order
  // link's ?k= never leaks in a Referer), and only our own pages may frame ours.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...SECURITY_HEADERS,
          ...(isProductionSite ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
