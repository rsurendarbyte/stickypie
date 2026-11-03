// GET /api/print-job/<key>/file?item=<line id>&n=<file #>[&dl=1]
// One print file of an open print job, served from this site so the page can
// draw it onto the A3 sheets (and download it with a proper name).
import { orderCode, posterSizeLabel, slugify } from "@stickypie/shared";
import { itemFiles, openPrintJob } from "@/lib/print-job";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const order = await openPrintJob(token);
  if (!order) return new Response("This print job is closed", { status: 404 });
  const params = new URL(req.url).searchParams;
  const item = order.items.find((i) => i.id === params.get("item"));
  const n = Number(params.get("n") ?? 0);
  const src = item ? itemFiles(item)[n] : undefined;
  if (!item || !src) return new Response("File not found", { status: 404 });

  const upstream = await fetch(new URL(src, req.url), { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response("Could not fetch the file", { status: 502 });
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) return new Response("Not an image", { status: 502 });

  const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "private, no-store" };
  if (params.get("dl")) {
    const files = itemFiles(item).length;
    const name = slugify(
      item.packPosters?.[n]
        ? `${orderCode(order.id)} ${n + 1} ${item.packPosters[n].name} ${posterSizeLabel(item.packPosters[n].inches)} x${item.quantity}`
        : `${orderCode(order.id)} ${item.name}${item.sizeInches ? ` ${item.sizeInches}in` : ""} x${item.quantity}${files > 1 ? ` ${n + 1}` : ""}`
    );
    headers["Content-Disposition"] = `attachment; filename="${name}.${EXT[type] ?? "png"}"`;
  }
  return new Response(upstream.body, { headers });
}
