import type { Metadata, Viewport } from "next";
import { preconnect } from "react-dom";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { shopThemeCss } from "@stickypie/shared";
import ThemeTryout from "@/components/theme-tryout";
import CursorTrail from "@/components/cursor-trail";
import { CartProvider } from "@/components/cart-context";
import { ConfirmProvider } from "@/components/confirm-dialog";
import MildBackground from "@/components/mild-background";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import MobileTabBar from "@/components/mobile-tab-bar";
import CartDrawer from "@/components/cart-drawer";
import CartShell from "@/components/cart-shell";
import SiteChrome from "@/components/site-chrome";
import NavTracker from "@/components/nav-tracker";
import VersionCheck from "@/components/version-check";
import VisitorCount from "@/components/visitor-count";
import AuthCookieSync from "@/components/auth-cookie-sync";
import { META_PIXEL_SCRIPT, PRIVATE_URL_SCRIPT } from "@/lib/meta-pixel";
import { stickerCursorCss } from "@/lib/sticker-cursor";
import PerfProbe from "@/components/perf-probe";
import PuzzleLauncher from "@/components/puzzle-launcher";
import ShareSheet from "@/components/share-sheet";
import InstallApp from "@/components/install-app";
import { LITE_SCRIPT } from "@/lib/lite-script";
import { VIEW_SCRIPT } from "@/lib/view-script";
import { STALE_BUILD_SCRIPT } from "@/lib/stale-build-script";
import { PUZZLE_BOOT_SCRIPT } from "@/lib/puzzle-boot";
import { VISIT_SEED_SCRIPT } from "@/lib/skin-seed";
import { siteUrl, supabaseConfigured } from "@/lib/mode";
import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, isProductionSite } from "@/lib/site";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Plain files in public/ so Cloudflare serves them as free static assets
  // (Next's app/icon routes would run the Worker on every favicon request).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  robots: isProductionSite()
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // App-like on phones: no pinch zoom (iOS also needs the touch-action rule in globals.css).
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The picture host and the live catalogue: connect early, a slow network's first cost.
  if (process.env.NEXT_PUBLIC_IMAGE_HOST) preconnect(process.env.NEXT_PUBLIC_IMAGE_HOST);
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL, { crossOrigin: "anonymous" });
  return (
    // data-lite (LITE_SCRIPT) and data-view (VIEW_SCRIPT) are set before React hydrates.
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Theme colours (SHOP_THEME in packages/shared/src/theme.ts) */}
        <style dangerouslySetInnerHTML={{ __html: shopThemeCss() }} />
        {/* The mouse pointer as a theme-coloured sticker arrow (lib/sticker-cursor.ts) */}
        <style dangerouslySetInnerHTML={{ __html: stickerCursorCss() }} />
        <script dangerouslySetInnerHTML={{ __html: STALE_BUILD_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LITE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: VISIT_SEED_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: VIEW_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: PUZZLE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: PRIVATE_URL_SCRIPT }} />
        {/* Meta pixel for ads (prod only: the ID is set in .env.prod) */}
        {META_PIXEL_SCRIPT && <script dangerouslySetInnerHTML={{ __html: META_PIXEL_SCRIPT }} />}
      </head>
      <body className="bg-ink font-sans text-snow antialiased">
        {/* Local only: live theme colour picker (never in a production build) */}
        {process.env.NODE_ENV !== "production" && <ThemeTryout />}
        <ConfirmProvider>
        <CartProvider>
          <VersionCheck />
          <VisitorCount />
          <NavTracker />
          <AuthCookieSync />
          <PerfProbe />
          <PuzzleLauncher />
          <ShareSheet />
          <InstallApp />
          <SiteChrome>
            <MildBackground />
            <Nav />
            <CursorTrail />
          </SiteChrome>
          <CartShell>
            <main className="min-h-screen">{children}</main>
            <SiteChrome>
              <Footer demoMode={!supabaseConfigured()} />
              {/* keeps the footer clear of the phone tab bar */}
              <div aria-hidden className="h-[var(--tabbar,0px)]" />
              <MobileTabBar />
            </SiteChrome>
          </CartShell>
          <SiteChrome>
            <CartDrawer />
          </SiteChrome>
        </CartProvider>
        </ConfirmProvider>
      </body>
    </html>
  );
}
