import { NextResponse } from "next/server";
import { homePageSchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";

/** Saves the hero and the page's sections at once. */
export async function PUT(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = homePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid home page" }, { status: 400 });
  }
  try {
    const page = await auth.driver.updateHomePage(parsed.data);
    return NextResponse.json({ page });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the home page" },
      { status: 400 }
    );
  }
}
