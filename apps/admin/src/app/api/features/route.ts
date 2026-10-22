import { NextResponse } from "next/server";
import { featureFlagsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves all feature switches at once. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = featureFlagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feature switches" }, { status: 400 });
  }
  try {
    const features = await auth.driver.updateFeatures(parsed.data);
    return NextResponse.json({ features });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save" },
      { status: 400 }
    );
  }
}
