// Branded transactional emails. Used by the storefront (welcome email, sent
// through Resend) and by scripts/configure-auth.mjs (Supabase's reset-password
// email). Deliberately import-free so Node can load this file directly.

export type EmailContent = { subject: string; html: string; text: string };

type EmailBrand = { siteUrl: string; supportEmail: string };

const BRAND = "#ff2e63";
const INK = "#15161e";
const MUTED = "#64708a";
const PAGE = "#f6f7f9";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  brand: EmailBrand;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  afterCta?: string;
  footnote: string;
}): string {
  const { brand } = opts;
  const host = brand.siteUrl.replace(/^https?:\/\//, "");
  const paragraphs = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${MUTED}">${p}</p>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAGE}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
    <tr><td style="padding:0 4px 18px">
      <a href="${brand.siteUrl}" style="text-decoration:none;font-size:24px;font-weight:800;color:${INK};letter-spacing:-0.5px">
        <img src="${brand.siteUrl}/icons/icon-192.png" width="36" height="36" alt="StickyPie" style="display:inline-block;width:36px;height:36px;border:0;border-radius:10px;vertical-align:middle;margin-right:8px"><span style="vertical-align:middle">Sticky<span style="color:#f9530a">Pie</span></span>
      </a>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e4e7ee;border-radius:18px;overflow:hidden">
      <div style="height:6px;background:${BRAND};background-image:linear-gradient(90deg,#ff2e63,#ff7a3c)"></div>
      <div style="padding:30px 28px 26px">
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:${INK}">${opts.heading}</h1>
        ${paragraphs}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="border-radius:12px;background:${BRAND};background-image:linear-gradient(90deg,#ff2e63,#ff7a3c)">
          <a href="${opts.cta.url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(opts.cta.label)}</a>
        </td></tr></table>
        ${opts.afterCta ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${MUTED}">${opts.afterCta}</p>` : ""}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #edeff4;background:#fbfcfd">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">${opts.footnote}</p>
      </div>
    </td></tr>
    <tr><td style="padding:18px 4px 0;text-align:center;font-size:12px;line-height:1.7;color:${MUTED}">
      Premium die-cut vinyl stickers · <a href="${brand.siteUrl}" style="color:${MUTED}">${host}</a><br>
      Questions? <a href="mailto:${brand.supportEmail}" style="color:${BRAND};text-decoration:none">${brand.supportEmail}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Sent by the storefront right after a shopper creates an account. */
export function welcomeEmail(brand: EmailBrand, name: string): EmailContent {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Welcome aboard, ${escapeHtml(first)}!` : "Welcome aboard!";
  return {
    subject: "Welcome to StickyPie — your sticker stash starts here ✨",
    html: layout({
      brand,
      preheader: "Your account is ready — check out faster and track every order.",
      heading: greeting,
      paragraphs: [
        "Your StickyPie account is ready. Use it to check out faster and follow every order — from packing to your doorstep.",
        `Your order history and live tracking are always in <a href="${brand.siteUrl}/account" style="color:${BRAND};text-decoration:none;font-weight:600">My orders</a>.`,
      ],
      cta: { label: "Browse stickers", url: `${brand.siteUrl}/stickers` },
      footnote: `You're getting this because an account was created with this email at ${brand.siteUrl.replace(/^https?:\/\//, "")}. Not you? Write to <a href="mailto:${brand.supportEmail}" style="color:${BRAND};text-decoration:none">${brand.supportEmail}</a> and we'll sort it out.`,
    }),
    text: [
      first ? `Welcome aboard, ${first}!` : "Welcome aboard!",
      "",
      "Your StickyPie account is ready. Use it to check out faster and follow every order.",
      `Browse stickers: ${brand.siteUrl}/stickers`,
      `My orders: ${brand.siteUrl}/account`,
      "",
      `Not you? Write to ${brand.supportEmail}.`,
    ].join("\n"),
  };
}

/**
 * Supabase "Reset password" template. Supabase fills in the link, so the
 * default keeps its {{ .ConfirmationURL }} placeholder.
 */
export function resetPasswordEmail(
  brand: EmailBrand,
  link = "{{ .ConfirmationURL }}"
): EmailContent {
  return {
    subject: "Reset your StickyPie password",
    html: layout({
      brand,
      preheader: "Choose a new password — this link works once.",
      heading: "Reset your password",
      paragraphs: [
        "We got a request to reset the password for your StickyPie account. Tap the button to choose a new one.",
      ],
      cta: { label: "Choose a new password", url: link },
      afterCta: "The link works once and expires after an hour.",
      footnote:
        "Didn't ask for this? You can safely ignore this email — your password stays the same.",
    }),
    text: `Reset your StickyPie password: ${link}\n\nThe link works once and expires after an hour. Didn't ask for this? Ignore this email.`,
  };
}
