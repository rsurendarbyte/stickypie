import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  ADMIN_COOKIE,
  demoToken,
  supabaseAnonKey,
  supabaseConfigured,
  supabaseUrl,
} from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-check";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * This project's Supabase session cookies (sb-<project>-auth-token, incl. chunked
 * .0/.1 parts). Only ours: localhost cookies are shared across ports, so the dev
 * and prod admins see each other's logins and must not delete them.
 */
function authCookies(request: NextRequest): string[] {
  const project = new URL(supabaseUrl()!).hostname.split(".")[0];
  return request.cookies
    .getAll()
    .map((c) => c.name)
    .filter((name) => name.startsWith(`sb-${project}-auth-token`));
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
    // Checked here with the project's cached public key (refreshing an expired
    // login if needed), not a round trip to Supabase Auth on every request.
    const { data: auth, error } = await supabase.auth.getClaims();
    const user = auth?.claims.sub ? { id: auth.claims.sub } : null;
    // Signed in is not enough: only accounts in admin_users get past this gate
    // (a shop customer's login must never open the admin, not even its pages).
    let notAdmin = false;
    if (user) {
      const { admin, failed } = await isAdminUser(supabase, user.id);
      authed = admin;
      notAdmin = !admin && !failed; // a definite "no", not a failed lookup
    }
    // Expired/revoked login (e.g. signed out elsewhere, or a session from the
    // other environment): drop its cookies so every later request doesn't retry it.
    // Only on a definite rejection — a network blip must not log the admin out.
    const rejected = [400, 401, 403].includes(Number(error?.status));
    // Also drop a non-admin's login, so it isn't checked again on every request.
    staleSession = ((!user && rejected) || notAdmin) && authCookies(request).length > 0;
  }

  // A refresh above replaced the login's tokens; a response that isn't `response`
  // must carry them too, or the browser keeps a token that is about to stop working.
  const withSession = (res: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  };

  if (!authed && !isLogin) {
    const res = withSession(
      isApi
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url))
    );
    if (staleSession) authCookies(request).forEach((name) => res.cookies.delete(name));
    return res;
  }
  if (staleSession) authCookies(request).forEach((name) => response.cookies.delete(name));
  if (authed && isLogin) {
    return withSession(NextResponse.redirect(new URL("/", request.url)));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|icons/).*)"],
};
