import type { AnchorHTMLAttributes } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  // Accepted (and ignored) so call sites written for next/link keep working.
  prefetch?: boolean | null;
  scroll?: boolean;
  replace?: boolean;
};

/**
 * In-site link that opens the page as a normal page load instead of a Next.js
 * client-side navigation. Shop pages are ready-made static files, which
 * Cloudflare serves free and without limit; a client-side navigation (and
 * Next's link prefetching) fetches page data from the Worker instead, which
 * counts against the free plan's 100,000 requests a day and its CPU limit.
 * The page change is smoothed by the cross-page view transition in globals.css.
 */
export default function PageLink({ prefetch: _prefetch, scroll: _scroll, replace: _replace, ...props }: Props) {
  return <a {...props} />;
}
