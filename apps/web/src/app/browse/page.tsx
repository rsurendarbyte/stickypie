import type { Metadata } from "next";
import { Suspense } from "react";
import BrowseRedirect from "@/components/browse-redirect";
import StickerLoader from "@/components/sticker-loader";

// Old address. Listings moved to /stickers and /stickers/<category>; this
// forwards old links and bookmarks (keeping ?q= and ?sort=).
export const metadata: Metadata = {
  title: "Stickers",
  robots: { index: false, follow: true },
  alternates: { canonical: "/stickers" },
};

export default function BrowsePage() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Suspense fallback={<StickerLoader size={56} />}>
        <BrowseRedirect />
      </Suspense>
    </div>
  );
}
