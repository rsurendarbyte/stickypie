// Google Search Console ownership file. Answered by the Worker (Google checks
// it now and then) rather than shipped as a static asset: static .html files
// are served without the extension, and Google won't verify through that redirect.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("google-site-verification: google9d51875f5ce68f01.html", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
