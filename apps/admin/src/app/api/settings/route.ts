import { NextResponse } from "next/server";
import { storeSettingsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the minimum order + shipping zones. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = storeSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
      { status: 400 }
    );
  }
  try {
    const settings = await auth.driver.updateSettings(parsed.data);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save settings" },
      { status: 400 }
    );
  }
}
