import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { slugify } from "@stickypie/shared";
import { supabaseConfigured } from "@/lib/auth";
import { requireAdminApi } from "@/lib/data";
import { r2Client, r2Config } from "@/lib/r2";
import { toWebp } from "@/lib/thumbs";
import { createServerSupabase } from "@/lib/supabase";

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

function uploadDir(): string {
  // Demo mode: drop files straight into the storefront's public folder.
  return process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "../web/public/stickers");
}

/**
 * Upload destination priority:
 *  1. Cloudflare R2 (production: free egress, CDN-cacheable)
 *  2. Supabase Storage (if R2 isn't configured)
 *  3. Local storefront folder (demo mode)
 */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Max file size is 4 MB" }, { status: 400 });
  }

  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "sticker";
  let ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "png").toLowerCase();

  // "maxPx" = a picture only ever shown on the shop (AI style cards and
  // samples): stored as a WebP no bigger than that, never the full PNG.
  const maxPx = Number(form?.get("maxPx")) || 0;
  let body: Uint8Array = new Uint8Array(await file.arrayBuffer());
  let contentType = file.type;
  if (maxPx > 0) {
    try {
      body = await toWebp(body.slice().buffer, Math.min(maxPx, 2400), 82);
      ext = "webp";
      contentType = "image/webp";
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? `Could not shrink the picture: ${err.message}` : "Could not shrink the picture" },
        { status: 500 }
      );
    }
  }
  const name = `${base}-${Date.now()}.${ext}`;

  const r2 = r2Config();
  if (r2) {
    try {
      await r2Client(r2).send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: name,
          Body: body,
          ContentType: contentType,
          // Names are unique per upload, so let the CDN cache forever.
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? `R2 upload failed: ${err.message}` : "R2 upload failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: `${r2.publicUrl}/${name}` });
  }

  if (!supabaseConfigured()) {
    const dir = uploadDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
    return NextResponse.json({ url: `/stickers/${name}` });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.storage
    .from("product-images")
    .upload(name, body, { contentType, upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data } = supabase.storage.from("product-images").getPublicUrl(name);
  return NextResponse.json({ url: data.publicUrl });
}
