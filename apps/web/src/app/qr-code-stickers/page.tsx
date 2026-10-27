import type { Metadata } from "next";
import BackButton from "@/components/back-button";
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
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 pb-44 sm:px-8 sm:pb-24">
      {/* desktop: Back on the page (phones have it in the header) */}
      <div className="mb-3 hidden sm:block">
        <BackButton fallback="/custom-stickers" />
      </div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">QR code stickers</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-fog">
        UPI, WhatsApp, Instagram or website QR with a label like “Scan to pay” — waterproof die-cut vinyl.
      </p>
      <QrStickerBuilder />
      <CustomRequestForm />
    </div>
  );
}
