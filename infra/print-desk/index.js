// The printing person's job link on a neutral address (no shop name in the page):
//   https://<this worker>.workers.dev/j/<key>  →  the shop's /print-job/<key>
// One Worker for both shops: a print key belongs to one database, so it asks the
// live shop first and the dev shop if the live one doesn't know the key (the
// same for the page's own files). Only what the print page needs passes
// through; everything else is a plain 404.
const CLOSED = "This print job is closed";
const BUSY_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>Print job</title><body style="font:16px system-ui;text-align:center;padding:20vh 16px">The print job is busy. Trying again in a moment…</body>`;
const FILE_TRIES = 3;
const FILE = /^\/api\/print-job\/[a-f0-9]{32}\/file$/;
const ALLOWED = [/^\/print-job\/[a-f0-9]{32}$/, FILE, /^\/_next\/static\//, /^\/_next\/image/];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Not found", { status: 404 });
    const short = url.pathname.match(/^\/j\/([a-f0-9]{32})$/);
    const path = short ? `/print-job/${short[1]}` : url.pathname;
    if (!ALLOWED.some((re) => re.test(path))) return new Response("Not found", { status: 404 });

    const once = (shop) =>
      fetch(new URL(path + url.search, shop), {
        headers: { Accept: request.headers.get("Accept") ?? "*/*", "User-Agent": request.headers.get("User-Agent") ?? "" },
        redirect: "manual",
      });
    // A shop can fail for a moment (Cloudflare error 1102), so it gets a few tries.
    const ask = async (shop) => {
      let res = await once(shop);
      for (let n = 0; n < 2 && res.status >= 500; n++) {
        await new Promise((r) => setTimeout(r, 400));
        res = await once(shop);
      }
      return res;
    };
    // The print page answers 200 with a "closed" message for keys it doesn't know.
    const isClosed = async (res) => res.status === 404 || (short && (await res.clone().text()).includes(CLOSED));
    let shop = env.SHOP_URL;
    let upstream = await ask(shop);
    const failed = upstream.status >= 500;
    if ((failed || (await isClosed(upstream))) && env.DEV_SHOP_URL) {
      const dev = await ask(env.DEV_SHOP_URL);
      if (dev.ok && !(await isClosed(dev))) [upstream, shop] = [dev, env.DEV_SHOP_URL];
      // A shop that failed can't say the job is closed: never show "closed" on a guess.
      else if (failed || dev.status >= 500) {
        if (short) return new Response(BUSY_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "5", "X-Robots-Tag": "noindex, nofollow" } });
        return new Response("Busy, try again", { status: 503, headers: { "Retry-After": "5" } });
      }
    }
    const headers = new Headers(upstream.headers);
    headers.delete("set-cookie");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Referrer-Policy", "no-referrer");
    if (!upstream.ok || !FILE.test(path)) return new Response(upstream.body, { status: upstream.status, headers });

    // A shop's answer can stop part way and still look like a success, which
    // would print half a poster. Only a file of the stated size goes through.
    headers.delete("x-file-size");
    for (let n = 0; n < FILE_TRIES; n++) {
      const size = Number(upstream.headers.get("x-file-size"));
      const bytes = await upstream.arrayBuffer().catch(() => null);
      // No stated size (a shop not yet updated): nothing to check it against, so it passes.
      if (bytes && (!size || bytes.byteLength === size)) return new Response(bytes, { status: 200, headers });
      upstream = await ask(shop);
      if (!upstream.ok) break;
    }
    return new Response("Busy, try again", { status: 503, headers: { "Retry-After": "5" } });
  },
};
