import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  ADMIN_COOKIE,
  demoToken,
  supabaseAnonKey,
  supabaseConfigured,
  supabaseUrl,
} from "@/lib/auth";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Supabase session cookies (sb-<project>-auth-token, incl. chunked .0/.1 parts). */
function authCookies(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map((c) => c.name)
    .filter((name) => /^sb-.+-auth-token/.test(name));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const isApi = pathname.startsWith("/api");

  let authed = false;
  let staleSession = false;
  let response = NextResponse.next({ request });

  if (!supabaseConfigured()) {
    authed = request.cookies.get(ADMIN_COOKIE)?.value === (await demoToken());
  } else {
    const supabase = createServerClient(supabaseUrl()!, supabaseAnonKey()!, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    // Signed in is not enough: only accounts in admin_users get past this gate
    // (a shop customer's login must never open the admin, not even its pages).
    let notAdmin = false;
    if (user) {
      const { data: adminRow, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      authed = Boolean(adminRow);
      notAdmin = !adminRow && !adminError; // a definite "no", not a failed lookup
    }
    // Expired/revoked login (e.g. signed out elsewhere, or a session from the
    // other environment): drop its cookies so every later request doesn't retry it.
    // Only on a definite rejection — a network blip must not log the admin out.
    const rejected = [400, 401, 403].includes(Number(error?.status));
    // Also drop a non-admin's login, so it isn't checked again on every request.
    staleSession = ((!user && rejected) || notAdmin) && authCookies(request).length > 0;
  }

  if (!authed && !isLogin) {
    const res = isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    if (staleSession) authCookies(request).forEach((name) => res.cookies.delete(name));
    return res;
  }
  if (staleSession) authCookies(request).forEach((name) => response.cookies.delete(name));
  if (authed && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|icons/).*)"],
};
