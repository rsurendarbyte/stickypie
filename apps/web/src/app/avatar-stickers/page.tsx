import type { Metadata } from "next";
import Link from "@/components/page-link";
import AvatarStickerBuilder from "@/components/avatar-sticker-builder";
import CustomRequestForm from "@/components/custom-request-form";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Avatar Stickers – Waterproof Vinyl Stickers of You, From Your Photo",
  description:
    "Send a photo and pick trending styles — 90s retro, anime, action figure, 3D cartoon and more — and we make AI sticker packs of you, a pack of avatar stickers in each style, printed on waterproof vinyl and shipped across India.",
  path: "/avatar-stickers",
});

export default function AvatarStickersPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-20 pb-44 sm:px-8 sm:pt-24 sm:pb-24">
      <Link href="/custom-stickers" className="block w-fit text-xs font-semibold text-fog hover:text-snow">
        ← All custom options
      </Link>
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand uppercase">
        New · Avatar sticker packs
      </span>
      <h1 className="mt-2 font-display text-[28px] leading-[1.1] font-bold sm:text-[42px]">
        Stickers of you, in trending styles
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-fog sm:text-base">
        Pick your styles and send a selfie. We use AI to make a pack of avatar stickers of you in each style, then
        print them on waterproof vinyl.
      </p>
      <AvatarStickerBuilder />
      <CustomRequestForm />
    </div>
  );
}
