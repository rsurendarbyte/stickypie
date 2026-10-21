import { NextResponse } from "next/server";
import { CONTACT_TOPICS, SUPPORT_EMAIL, contactSchema } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { sendEmail } from "@/lib/email";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Contact form: saved for the admin (Messages) and emailed to support. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
  }
  const { website, ...input } = parsed.data;
  // Bots fill the hidden field; pretend it worked and drop it.
  if (website) return NextResponse.json({ ok: true });

  try {
    await getDriver().createContactMessage(input);
  } catch (err) {
    console.error("[contact] could not save message:", err);
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 500 });
  }

  const topic = CONTACT_TOPICS[input.topic];
  const lines = [
    `From: ${input.name} <${input.email}>`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.orderCode ? `Order: ${input.orderCode}` : null,
    `Topic: ${topic}`,
    "",
    input.message,
  ].filter((l) => l !== null) as string[];
  await sendEmail(
    SUPPORT_EMAIL,
    {
      subject: `Contact form: ${topic} — ${input.name}`,
      text: lines.join("\n"),
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">${lines
        .map((l) => (l ? esc(l) : "&nbsp;"))
        .join("<br>")}</div>`,
    },
    { replyTo: input.email }
  );
  return NextResponse.json({ ok: true });
}
