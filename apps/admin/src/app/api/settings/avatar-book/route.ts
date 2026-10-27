import { NextResponse } from "next/server";
import { storeSettingsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

const bookSchema = storeSettingsSchema.pick({ avatarBook: true, avatarStyles: true });

/** Saves the avatar sticker book (pages, price, styles); other settings stay as they are. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  const parsed = bookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }
  try {
    const current = await auth.driver.getSettings();
    const settings = await auth.driver.updateSettings({ ...current, ...parsed.data });
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save";
    // The avatar columns come from a migration; until it's applied the save can't land.
    const missing = /avatar_(book|styles)/.test(message) && /column|schema cache/.test(message);
    return NextResponse.json(
      {
        error: missing
          ? "The database isn't set up for avatar packs yet — run npm run db:apply, then save again."
          : message,
      },
      { status: 400 }
    );
  }
}
