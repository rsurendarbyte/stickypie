// Shopper writes back on their private conversation page. Reopens the
// conversation for the admin (status new) and emails support an alert.
import { NextResponse } from "next/server";
import { z } from "zod";
import { CONTACT_TOPICS, SUPPORT_EMAIL } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { publicThread, signalThread, threadForKey } from "@/lib/contact-thread";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  k: z.string().min(10).max(100),
  body: z.string().trim().min(2, "Write a little more").max(2000, "Keep it under 2000 characters"),
  /** Honeypot. */
  website: z.string().max(200).optional(),
});

/** Most answers a shopper can add in a row before we reply, and in total. */
const MAX_IN_A_ROW = 5;
const MAX_TOTAL = 40;

/** The conversation for the help bubble (?k=<key>). */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const k = new URL(req.url).searchParams.get("k") ?? "";
  const thread = await threadForKey(id, k);
  if (!thread) return NextResponse.json({ error: "This conversation link isn't valid." }, { status: 404 });
  return NextResponse.json({ thread: publicThread(thread) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check your message" }, { status: 400 });
  }
  const { k, body, website } = parsed.data;
  const thread = await threadForKey(id, k);
  if (!thread) return NextResponse.json({ error: "This conversation link isn't valid." }, { status: 404 });
  if (website) return NextResponse.json({ ok: true });

  const mine = thread.replies.filter((r) => r.author === "customer");
  let inARow = 0;
  for (let i = thread.replies.length - 1; i >= 0 && thread.replies[i].author === "customer"; i--) inARow++;
  if (inARow >= MAX_IN_A_ROW || mine.length >= MAX_TOTAL) {
    return NextResponse.json(
      { error: "Thanks, we have your messages. Please wait for our reply, or email us." },
      { status: 429 }
    );
  }

  let reply;
  try {
    reply = await getDriver().addContactReply(id, "customer", body);
  } catch (err) {
    console.error("[contact] could not save answer:", err);
    return NextResponse.json({ error: "Couldn't send your message. Please try again." }, { status: 500 });
  }

  // the shopper's other open tabs / phone update too
  void signalThread(thread);

  const lines = [
    `${thread.name} <${thread.email}> wrote back (${CONTACT_TOPICS[thread.topic] ?? thread.topic}):`,
    "",
    body,
    "",
    "Reply in the admin: Messages.",
  ];
  await sendEmail(
    SUPPORT_EMAIL,
    {
      subject: `New reply from ${thread.name}`,
      text: lines.join("\n"),
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">${lines
        .map((l) => (l ? l.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) : "&nbsp;"))
        .join("<br>")}</div>`,
    },
    { replyTo: thread.email }
  );
  return NextResponse.json({ ok: true, reply });
}
