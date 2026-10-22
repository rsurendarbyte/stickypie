import { NextResponse } from "next/server";
import { SUPPORT_EMAIL, signupSchema, welcomeEmail } from "@stickypie/shared";
import { sendEmail } from "@/lib/email";
import { CodeError, checkCode, clearCode } from "@/lib/email-codes";
import { siteUrl, supabaseUrl } from "@/lib/mode";
import { accountsEnabled } from "@/lib/shopper";

/**
 * Step 2 of creating an account: with the 6-digit code from the email
 * (proving the shopper owns the address), creates a confirmed account so the
 * browser can sign in and pay straight away.
 */
export async function POST(req: Request) {
  if (!accountsEnabled()) {
    return NextResponse.json({ error: "Accounts are not available" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details" },
      { status: 400 }
    );
  }
  const { email, password, name, code } = parsed.data;

  try {
    await checkCode(email, code);
  } catch (err) {
    if (err instanceof CodeError) return NextResponse.json({ error: err.message, code: "bad_code" }, { status: err.status });
    console.error("[signup] code check failed", err);
    return NextResponse.json({ error: "Couldn't check the code. Please try again." }, { status: 502 });
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    }),
  });

  if (res.ok) {
    await clearCode(email).catch(() => {});
    // A failed welcome email must never block the shopper's checkout.
    await sendEmail(email, welcomeEmail({ siteUrl: siteUrl(), supportEmail: SUPPORT_EMAIL }, name));
    return NextResponse.json({ ok: true });
  }

  const data = (await res.json().catch(() => ({}))) as { msg?: string; message?: string; error_code?: string };
  const message = data.msg ?? data.message ?? "";
  if (data.error_code === "email_exists" || /already (been )?registered|already exists/i.test(message)) {
    return NextResponse.json(
      { error: "An account with this email already exists — sign in instead.", code: "exists" },
      { status: 409 }
    );
  }
  if (/password/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error("[signup] Supabase Auth refused account creation:", res.status, message);
  return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 502 });
}
