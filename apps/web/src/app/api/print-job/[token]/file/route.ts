// GET /api/print-job/<key>/file?item=<line id>&n=<file #>[&dl=1]
// One print file of an open print job, served from this site so the page can
// draw it onto the A3 sheets (and download it with a proper name).
import { orderCode, posterSizeLabel, slugify } from "@stickypie/shared";
import { itemFiles, openPrintJob } from "@/lib/print-job";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * The whole file, read before answering: passed straight through, big files
 * often stopped part way and still looked like a success, so a poster printed
 * half drawn. The stated length tells the browser if the answer is ever short.
 */
async function readFile(url: URL) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const upstream = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!upstream?.ok) continue;
    const bytes = await upstream.arrayBuffer().catch(() => null);
    const expected = Number(upstream.headers.get("content-length"));
    if (!bytes || (expected && bytes.byteLength !== expected)) continue;
    return { bytes, type: (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() };
  }
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const order = await openPrintJob(token);
  if (!order) return new Response("This print job is closed", { status: 404 });
  const params = new URL(req.url).searchParams;
  const item = order.items.find((i) => i.id === params.get("item"));
  const n = Number(params.get("n") ?? 0);
  const src = item ? itemFiles(item)[n] : undefined;
  if (!item || !src) return new Response("File not found", { status: 404 });

  const file = await readFile(new URL(src, req.url));
  if (!file) return new Response("Could not fetch the file", { status: 502 });
  const { bytes, type } = file;
  if (!type.startsWith("image/")) return new Response("Not an image", { status: 502 });

  const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "private, max-age=3600", "Content-Length": String(bytes.byteLength) };
  if (params.get("dl")) {
    const files = itemFiles(item).length;
    const name = slugify(
      item.packPosters?.[n]
        ? `${orderCode(order.id)} ${n + 1} ${item.packPosters[n].name} ${posterSizeLabel(item.packPosters[n].inches)} x${item.quantity}`
        : `${orderCode(order.id)} ${item.name}${item.sizeInches ? ` ${item.sizeInches}in` : ""} x${item.quantity}${files > 1 ? ` ${n + 1}` : ""}`
    );
    headers["Content-Disposition"] = `attachment; filename="${name}.${EXT[type] ?? "png"}"`;
  }
  return new Response(bytes, { headers });
}
