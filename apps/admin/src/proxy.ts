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
    authed = Boolean(user);
    // Expired/revoked login (e.g. signed out elsewhere, or a session from the
    // other environment): drop its cookies so every later request doesn't retry it.
    // Only on a definite rejection — a network blip must not log the admin out.
    const rejected = [400, 401, 403].includes(Number(error?.status));
    staleSession = !user && rejected && authCookies(request).length > 0;
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
