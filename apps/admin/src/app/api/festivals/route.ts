import { NextResponse } from "next/server";
import { festivalsSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the whole festivals list at once. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = festivalsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid festivals" },
      { status: 400 }
    );
  }
  try {
    const festivals = await auth.driver.updateFestivals(parsed.data);
    return NextResponse.json({ festivals });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error && /festivals/.test(err.message)
            ? "The festivals column is missing — run the latest database migration (npm run db:apply) first"
            : err instanceof Error
              ? err.message
              : "Could not save the festivals",
      },
      { status: 400 }
    );
  }
}
