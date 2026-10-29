import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { shopThemeCss } from "@stickypie/shared";
import ThemeTryout from "@/components/theme-tryout";
import { CartProvider } from "@/components/cart-context";
import { ConfirmProvider } from "@/components/confirm-dialog";
import MildBackground from "@/components/mild-background";
import Nav from "@/components/nav";
import CarCursor from "@/components/car-cursor";
import Footer from "@/components/footer";
import MobileTabBar from "@/components/mobile-tab-bar";
import CartDrawer from "@/components/cart-drawer";
import CartShell from "@/components/cart-shell";
import NavTracker from "@/components/nav-tracker";
import { META_PIXEL_SCRIPT } from "@/lib/meta-pixel";
import PerfProbe from "@/components/perf-probe";
import { LITE_SCRIPT } from "@/lib/lite-script";
import { VIEW_SCRIPT } from "@/lib/view-script";
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
  return (
    // data-lite (LITE_SCRIPT) and data-view (VIEW_SCRIPT) are set before React hydrates.
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Theme colours (SHOP_THEME in packages/shared/src/theme.ts) */}
        <style dangerouslySetInnerHTML={{ __html: shopThemeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: LITE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: VIEW_SCRIPT }} />
        {/* Meta pixel for ads (prod only: the ID is set in .env.prod) */}
        {META_PIXEL_SCRIPT && <script dangerouslySetInnerHTML={{ __html: META_PIXEL_SCRIPT }} />}
      </head>
      <body className="bg-ink font-sans text-snow antialiased">
        {/* Local only: live theme colour picker (never in a production build) */}
        {process.env.NODE_ENV !== "production" && <ThemeTryout />}
        <ConfirmProvider>
        <CartProvider>
          <NavTracker />
          <PerfProbe />
          <MildBackground />
          <Nav />
          <CarCursor />
          <CartShell>
            <main className="min-h-screen">{children}</main>
            <Footer demoMode={!supabaseConfigured()} />
            {/* keeps the footer clear of the phone tab bar */}
            <div aria-hidden className="h-[var(--tabbar,0px)]" />
            <MobileTabBar />
          </CartShell>
          <CartDrawer />
        </CartProvider>
        </ConfirmProvider>
      </body>
    </html>
  );
}
