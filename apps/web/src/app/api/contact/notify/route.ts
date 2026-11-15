// The admin console calls this after a reply or a status change: tells the
// shopper's open pages live, and (email: true) emails our latest reply with
// their conversation link. Only for an admin's access token (the admin app has
// no email or service keys of its own).
import { NextResponse } from "next/server";
import { z } from "zod";
import { SHOP_THEME, SUPPORT_EMAIL, contactReplyEmail } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/mode";
import { isAdminToken } from "@/lib/shopper";
import { signalThread, threadUrl } from "@/lib/contact-thread";

const schema = z.object({ messageId: z.string().uuid(), email: z.boolean().default(true) });

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !(await isAdminToken(token))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const m = await getDriver().getContactMessage(parsed.data.messageId);
  if (!m) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  await signalThread(m);
  const reply = m.replies.filter((r) => r.author === "admin").at(-1);
  if (!parsed.data.email || !reply) return NextResponse.json({ ok: true, emailed: false });

  const emailed = await sendEmail(
    m.email,
    contactReplyEmail(
      { siteUrl: siteUrl(), supportEmail: SUPPORT_EMAIL, colors: SHOP_THEME },
      { name: m.name, reply: reply.body, original: m.message, threadUrl: threadUrl(m) }
    )
  );
  return NextResponse.json({ ok: true, emailed });
}
