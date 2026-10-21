import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import CartDrawer from "@/components/cart-drawer";
import CartShell from "@/components/cart-shell";
import NavTracker from "@/components/nav-tracker";
import { siteUrl, supabaseConfigured } from "@/lib/mode";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, isProductionSite } from "@/lib/site";

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
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`}>
      <body className="bg-ink font-sans text-snow antialiased">
        <CartProvider>
          <NavTracker />
          <Nav />
          <CartShell>
            <main className="min-h-screen">{children}</main>
            <Footer demoMode={!supabaseConfigured()} />
          </CartShell>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
