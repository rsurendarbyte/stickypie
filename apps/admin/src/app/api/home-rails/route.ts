import { NextResponse } from "next/server";
import { homeRailsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the whole home page layout at once. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = homeRailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid layout" },
      { status: 400 }
    );
  }
  try {
    const rails = await auth.driver.updateHomeRails(parsed.data);
    return NextResponse.json({ rails });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the layout" },
      { status: 400 }
    );
  }
}
