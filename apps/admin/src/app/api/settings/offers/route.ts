import { NextResponse } from "next/server";
import { storeSettingsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

const offersSchema = storeSettingsSchema.pick({ thanksPercent: true });

/** Saves the default thank-you offer %; other settings stay as they are. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const parsed = offersSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid offer" }, { status: 400 });
  }
  try {
    const current = await auth.driver.getSettings();
    const settings = await auth.driver.updateSettings({ ...current, ...parsed.data });
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}
