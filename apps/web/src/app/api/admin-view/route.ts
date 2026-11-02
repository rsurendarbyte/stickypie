// "View as customer" from the admin order page: the admin console posts the
// admin's access token here; if it belongs to an admin we keep it in an
// httpOnly cookie for an hour so the order page (and invoice) open for them.
import { NextResponse } from "next/server";
import { ADMIN_VIEW_COOKIE, accountsEnabled, isAdminToken } from "@/lib/shopper";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const orderId = String(form?.get("orderId") ?? "");
  const token = String(form?.get("token") ?? "");
  const url = new URL(`/order/${encodeURIComponent(orderId)}`, req.url);
  const res = NextResponse.redirect(url, 303);
  if (accountsEnabled() && token && (await isAdminToken(token))) {
    res.cookies.set(ADMIN_VIEW_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/order",
      maxAge: 60 * 60,
    });
  }
  return res;
}
