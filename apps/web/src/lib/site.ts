// Deployment identity + SEO helpers. Values are read at BUILD time for the
// prerendered pages, so each environment needs its own build (see
// scripts/deploy.mjs, which feeds the wrangler.jsonc vars into the build).
import type { Metadata } from "next";
import { siteUrl } from "./mode";

export const SITE_NAME = "StickyPie";
export const SITE_TAGLINE = "Stick Your Style";
export const SITE_DESCRIPTION =
  "Buy die-cut vinyl stickers and premium wall posters online in India: AI stickers of you, car and bike stickers, and ready wall poster sets.";

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
  card,
  shareUrl,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  /** A ready 1200 × 630 share card (preferred over `image` by chat apps). */
  card?: string | null;
  /** The link people share, when it isn't the canonical page (a poster's puzzle). */
  shareUrl?: string;
  noindex?: boolean;
}): Metadata {
  const images = card
    ? [{ url: card, width: 1200, height: 630, alt: title, type: "image/jpeg" }]
    : image
      ? [{ url: image, alt: title }]
      : [SHARE_IMAGE];
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
      url: shareUrl ?? path,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: card ? [card] : image ? [image] : [SHARE_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
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

/**
 * A category page with fewer products than this is kept out of Google (noindex,
 * left out of the sitemap): a page with one or two products reads as an empty
 * page ("soft 404"). It comes back by itself once the category grows.
 */
export const MIN_INDEXED_CATEGORY = 3;
