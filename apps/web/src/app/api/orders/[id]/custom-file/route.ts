import { NextResponse } from "next/server";
import { CUSTOM_UPLOAD_STATUSES } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { UploadError, storeCustomFile } from "@/lib/custom-files";
import { shopperFromRequest } from "@/lib/shopper";


/** The order's owner uploads or replaces a custom sticker's artwork after paying (multipart: itemId + file). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const shopper = await shopperFromRequest(req);
  if (!shopper) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const driver = getDriver();
  const order = await driver.getOrder(id);
  if (!order || order.userId !== shopper.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (!(CUSTOM_UPLOAD_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json(
      {
        error:
          order.status === "pending"
            ? "You can upload your artwork once payment is confirmed."
            : "We've already started working on this order, so the design can't be changed now. Please contact us if something's wrong.",
      },
      { status: 409 }
    );
  }

  const form = await req.formData().catch(() => null);
  const itemId = form?.get("itemId");
  const file = form?.get("file");
  const item = order.items.find((i) => i.id === itemId);
  if (!item?.isCustom || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file for a custom sticker." }, { status: 400 });
  }
  try {
    const stored = await storeCustomFile(file);
    await driver.replaceCustomFile(order.id, item.id, stored.path, stored.url);
    return NextResponse.json({ url: stored.url });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[custom-file]", err);
    return NextResponse.json({ error: "Couldn't upload your file. Please try again." }, { status: 502 });
  }
}
