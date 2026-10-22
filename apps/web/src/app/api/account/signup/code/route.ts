import { NextResponse } from "next/server";
import { SUPPORT_EMAIL, signupCodeSchema, verificationCodeEmail } from "@stickypie/shared";
import { sendEmail } from "@/lib/email";
import { CodeError, issueCode } from "@/lib/email-codes";
import { siteUrl } from "@/lib/mode";
import { accountsEnabled } from "@/lib/shopper";

/** Step 1 of creating an account: email a 6-digit code to the address. */
export async function POST(req: Request) {
  if (!accountsEnabled()) {
    return NextResponse.json({ error: "Accounts are not available" }, { status: 404 });
  }
  const parsed = signupCodeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid email" }, { status: 400 });
  }
  const { email } = parsed.data;

  let code: string;
  try {
    code = await issueCode(email);
  } catch (err) {
    if (err instanceof CodeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[signup/code]", err);
    return NextResponse.json({ error: "Couldn't send a code right now. Please try again." }, { status: 502 });
  }

  const sent = await sendEmail(email, verificationCodeEmail({ siteUrl: siteUrl(), supportEmail: SUPPORT_EMAIL }, code));
  if (!sent) {
    // Local/dev without an email key: print the code so sign-up can be tested.
    if (process.env.SITE_ENV !== "production" && !process.env.RESEND_API_KEY) {
      console.warn(`[signup/code] email not configured — code for ${email}: ${code}`);
    } else {
      return NextResponse.json({ error: "Couldn't send the email. Please check the address and try again." }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true });
}
