import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stickypie/shared"],
  // Private console: never indexed, never framed.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
