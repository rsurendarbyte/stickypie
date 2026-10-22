import type { Metadata } from "next";
import Link from "next/link";
import CustomRequestForm from "@/components/custom-request-form";
import QrStickerBuilder from "@/components/qr-sticker-builder";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "QR Code Stickers – UPI, WhatsApp & Website QR Stickers Online",
  description:
    "Make your own QR code sticker: UPI payment, WhatsApp, Instagram or website QR with a label like “Scan to pay”. Waterproof die-cut vinyl, any quantity, shipped across India.",
  path: "/qr-code-stickers",
});

export default function QrCodeStickersPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 pb-24 sm:px-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">QR code stickers</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-fog">
        UPI, WhatsApp, Instagram or website QR with a label like “Scan to pay” — waterproof die-cut vinyl.
      </p>
      <Link
        href="/custom-stickers/design"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        Have your own logo or artwork? Print a custom sticker →
      </Link>
      <QrStickerBuilder />
      <CustomRequestForm />
    </div>
  );
}
