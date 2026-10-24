// Server-only: transactional email through Resend's HTTP API, with Brevo as the
// backup when Resend refuses or can't be reached (e.g. its free plan's 100
// emails a day are used up — Brevo's free plan adds 300 more).
// Without either key (e.g. local dev) emails are skipped, never fatal.
import { SUPPORT_EMAIL, type EmailContent } from "@stickypie/shared";

type Mail = { to: string; content: EmailContent; replyTo: string; from: { name: string; email: string } };

/** "StickyPie <noreply@stickypie.in>" → name + address. */
function sender() {
  const from = process.env.EMAIL_FROM ?? "StickyPie <noreply@stickypie.in>";
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || "StickyPie", email: m[2] } : { name: "StickyPie", email: from.trim() };
}

function viaResend(key: string, { to, content, replyTo, from }: Mail) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${from.name} <${from.email}>`,
      to: [to],
      reply_to: replyTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

function viaBrevo(key: string, { to, content, replyTo, from }: Mail) {
  return fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: from,
      to: [{ email: to }],
      replyTo: { email: replyTo },
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

export async function sendEmail(
  to: string,
  content: EmailContent,
  opts: { replyTo?: string } = {}
): Promise<boolean> {
  const providers = [
    { name: "Resend", key: process.env.RESEND_API_KEY, send: viaResend },
    { name: "Brevo", key: process.env.BREVO_API_KEY, send: viaBrevo },
  ].filter((p): p is typeof p & { key: string } => Boolean(p.key));
  if (!providers.length) {
    console.warn(`[email] RESEND_API_KEY / BREVO_API_KEY not set — skipped "${content.subject}"`);
    return false;
  }
  const mail: Mail = { to, content, replyTo: opts.replyTo ?? SUPPORT_EMAIL, from: sender() };
  for (const { name, key, send } of providers) {
    try {
      const res = await send(key, mail);
      if (res.ok) return true;
      console.error(`[email] ${name} refused "${content.subject}":`, res.status, (await res.text()).slice(0, 200));
    } catch (err) {
      console.error(`[email] could not send "${content.subject}" via ${name}:`, err);
    }
  }
  return false;
}
