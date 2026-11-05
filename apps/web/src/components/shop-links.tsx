import { Frame, Sticker } from "lucide-react";
import PageLink from "./page-link";

/** Both ways into the shop, side by side, wherever a page has nothing to show. */
export default function ShopLinks({ onClick }: { onClick?: () => void }) {
  return (
    <>
      <PageLink
        href="/stickers"
        onClick={onClick}
        className="peel-btn inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold"
      >
        <Sticker className="size-4" /> Stickers
      </PageLink>
      <PageLink
        href="/stickers/poster-packs"
        onClick={onClick}
        className="peel-btn peel-btn--light inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold"
      >
        <Frame className="size-4" /> Wall posters
      </PageLink>
    </>
  );
}
