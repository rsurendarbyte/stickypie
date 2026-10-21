import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "StickyPie Admin",
    template: "%s · StickyPie Admin",
  },
  description: "Inventory, catalog and order management for StickyPie.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${inter.variable}`}>
      <body className="bg-ink font-sans text-snow antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
