// The printing person's job link on a neutral address (no shop name in the page):
//   https://<this worker>.workers.dev/j/<key>  →  the shop's /print-job/<key>
// One Worker for both shops: a print key belongs to one database, so it asks the
// live shop first and the dev shop if the live one doesn't know the key (the
// same for the page's own files). Only what the print page needs passes
// through; everything else is a plain 404.
const ALLOWED = [/^\/print-job\/[a-f0-9]{32}$/, /^\/api\/print-job\/[a-f0-9]{32}\/file$/, /^\/_next\/static\//, /^\/_next\/image/];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
    const short = url.pathname.match(/^\/j\/([a-f0-9]{32})$/);
    const path = short ? `/print-job/${short[1]}` : url.pathname;
    if (!ALLOWED.some((re) => re.test(path))) return new Response("Not found", { status: 404 });

    const ask = (shop) =>
      fetch(new URL(path + url.search, shop), {
        headers: { Accept: request.headers.get("Accept") ?? "*/*", "User-Agent": request.headers.get("User-Agent") ?? "" },
        redirect: "manual",
      });
    let upstream = await ask(env.SHOP_URL);
    // The print page answers 200 with a "closed" message for keys it doesn't know.
    const unknown = upstream.status === 404 || (short && (await upstream.clone().text()).includes("This print job is closed"));
    if (unknown && env.DEV_SHOP_URL) {
      const dev = await ask(env.DEV_SHOP_URL);
      if (dev.ok && !(short && (await dev.clone().text()).includes("This print job is closed"))) upstream = dev;
    }
    const headers = new Headers(upstream.headers);
    headers.delete("set-cookie");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
