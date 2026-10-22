"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ALL_STICKERS_PATH, categoryPath } from "@stickypie/shared";
import StickerLoader from "./sticker-loader";

/** /browse?category=x&q=…&sort=… → /stickers/x?q=…&sort=… */
export default function BrowseRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const category = params.get("category");
    const sp = new URLSearchParams();
    for (const key of ["q", "sort"]) {
      const value = params.get(key);
      if (value) sp.set(key, value);
    }
    const path = category ? categoryPath(category) : ALL_STICKERS_PATH;
    const qs = sp.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  }, [params, router]);

  return <StickerLoader size={56} />;
}
