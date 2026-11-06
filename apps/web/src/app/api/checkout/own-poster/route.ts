import { NextResponse } from "next/server";
import { UploadError, storeCustomFile } from "@/lib/custom-files";
import { accountsEnabled, shopperFromRequest } from "@/lib/shopper";

/** Stores one of the shopper's own wall posters as they press Pay (multipart: file). The order refers to it by its URL. */
export async function POST(req: Request) {
  if (accountsEnabled() && !(await shopperFromRequest(req))) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a picture." }, { status: 400 });
  try {
    const stored = await storeCustomFile(file, "own-posters");
    return NextResponse.json({ url: stored.url });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[own-poster]", err);
    return NextResponse.json({ error: "Couldn't send your poster. Please try again." }, { status: 502 });
  }
}
