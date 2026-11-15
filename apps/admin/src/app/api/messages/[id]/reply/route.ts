// Admin reply to a contact message: saved here (RLS: admins only), then the
// storefront emails it to the shopper with their conversation link. The admin
// app has no email keys, so it hands the storefront the admin's access token.
import { NextResponse } from "next/server";
import { z } from "zod";
import { contactReplySchema } from "@stickypie/shared";
import { requireAdminApi } from "@/lib/data";
import { notifyStorefront } from "@/lib/storefront-notify";

type Ctx = { params: Promise<{ id: string }> };
const body = contactReplySchema.extend({
  /** Same shopper's other open messages: marked replied too (one conversation in the admin). */
  alsoIds: z.array(z.string().uuid()).max(20).default([]),
  /** false = only save it (e.g. already answered on WhatsApp). */
  email: z.boolean().default(true),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reply" }, { status: 400 });
  }
  try {
    const reply = await auth.driver.addContactReply(id, "admin", parsed.data.body);
    await Promise.all(
      parsed.data.alsoIds.filter((x) => x !== id).map((x) => auth.driver.setContactStatus(x, "replied"))
    );
    const emailed = await notifyStorefront(id, parsed.data.email);
    return NextResponse.json({ ok: true, reply, emailed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save the reply" }, { status: 400 });
  }
}
