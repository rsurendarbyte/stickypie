// Server-only: transactional email through Resend's HTTP API.
// Without RESEND_API_KEY (e.g. local dev) emails are skipped, never fatal.
import { SUPPORT_EMAIL, type EmailContent } from "@stickypie/shared";

export async function sendEmail(
  to: string,
  content: EmailContent,
  opts: { replyTo?: string } = {}
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${content.subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "StickyPie <noreply@stickypie.in>",
        to: [to],
        reply_to: opts.replyTo ?? SUPPORT_EMAIL,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[email] Resend refused "${content.subject}":`, res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] could not send "${content.subject}":`, err);
    return false;
  }
}
