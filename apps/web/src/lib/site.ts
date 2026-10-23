// Deployment identity + SEO helpers. Values are read at BUILD time for the
// prerendered pages, so each environment needs its own build (see
// scripts/deploy.mjs, which feeds the wrangler.jsonc vars into the build).
import type { Metadata } from "next";
import { siteUrl } from "./mode";

export const SITE_NAME = "StickyPie";
export const SITE_TAGLINE = "Stick Your Style";
export const SITE_DESCRIPTION =
  "Buy waterproof vinyl stickers online in India — car stickers, bike stickers, laptop stickers and helmet decals. Die-cut, UV-safe, peel and stick. Ships across India.";

/**
 * Only the production build may be indexed. dev.stickypie.in, workers.dev
 * previews and local builds are always noindex.
 */
export function isProductionSite(): boolean {
  return process.env.SITE_ENV === "production";
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Brand link-preview card (public/og-image.png, made by scripts/make-og-image.mjs). */
export const SHARE_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` };

/**
 * Metadata for a public, indexable page: canonical URL + share cards. Pages
 * without their own picture (home, listings) share the brand card; sticker
 * pages pass their artwork.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const images = image ? [{ url: image, alt: title }] : [SHARE_IMAGE];
  // Every page names the shop in its description too (the title already ends
  // in "· StickyPie"), so search and AI answers tie the page to the brand.
  if (!description.includes(SITE_NAME)) {
    const tail = ` | ${SITE_NAME}`;
    description =
      description.length + tail.length > 160
        ? `${description.slice(0, 160 - tail.length - 1).trimEnd()}…${tail}`
        : `${description}${tail}`;
  }
  return {
    title,
    description,
    alternates: { canonical: path },
    // Child openGraph/twitter objects replace the root ones wholesale, so the
    // shared fields are repeated here.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_IN",
      url: path,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [SHARE_IMAGE.url],
    },
  };
}

/** For checkout / order / payment pages — never indexed in any environment. */
export const PRIVATE_PAGE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
};

/** Serialize JSON-LD safely for a <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
