import { NextResponse } from "next/server";
import { slugify } from "@stickypie/shared";
import { supabaseUrl, webUrl } from "@/lib/auth";
import { requireAdminApi } from "@/lib/data";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/** Only our own image hosts — this route must not fetch arbitrary URLs. */
function allowedOrigins(): Set<string> {
  const origins = [webUrl(), supabaseUrl(), process.env.R2_PUBLIC_URL]
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return "";
      }
    });
  return new Set(origins.filter(Boolean));
}

/**
 * GET /api/image-download?url=<image url>&name=<product name>
 * Streams a product image back as a file download (R2 / Supabase / storefront
 * images are cross-origin, so a plain <a download> would just open them).
 */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  const params = new URL(req.url).searchParams;
  let target: URL;
  try {
    target = new URL(params.get("url") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  // Older images may still use the bucket's r2.dev address.
  const r2Dev = target.protocol === "https:" && /^pub-[a-z0-9]+\.r2\.dev$/.test(target.hostname);
  if (!["http:", "https:"].includes(target.protocol) || (!allowedOrigins().has(target.origin) && !r2Dev)) {
    return NextResponse.json({ error: "Image host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(target, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch the image" }, { status: 502 });
  }
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 400 });
  }

  const fromPath = target.pathname.split("/").pop() ?? "";
  const pathExt = fromPath.includes(".") ? fromPath.split(".").pop()!.toLowerCase() : "";
  const ext = EXT_BY_TYPE[type] ?? (pathExt || "png");
  const base = slugify(params.get("name") ?? "") || slugify(fromPath.replace(/\.[^.]+$/, "")) || "sticker";

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${base}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
