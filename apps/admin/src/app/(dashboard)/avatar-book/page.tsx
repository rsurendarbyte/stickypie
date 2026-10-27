import AvatarBookForm from "@/components/avatar-book-form";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Avatar packs" };

export default async function AvatarBookPage() {
  const settings = await (await getAdminDriver()).getSettings();

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Avatar sticker packs</h1>
      <p className="mt-1 text-sm text-fog">
        Shopper sends a photo and picks at least the minimum styles, one pack each, priced per pack; we make a pack of AI stickers in each. Switch it
        on or off in Features.
      </p>
      <div className="mt-6">
        <AvatarBookForm initial={settings} />
      </div>
    </div>
  );
}
