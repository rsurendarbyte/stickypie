import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { supabaseConfigured } from "@/lib/auth";
import { requireAdminApi } from "@/lib/data";
import { r2Client, r2Config } from "@/lib/r2";
import { createServerSupabase } from "@/lib/supabase";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

/** Lists previously uploaded images so products can reuse them. */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;

  const r2 = r2Config();
  if (r2) {
    try {
      const res = await r2Client(r2).send(
        new ListObjectsV2Command({ Bucket: r2.bucket, MaxKeys: 500 })
      );
      const images = (res.Contents ?? [])
        .filter((obj) => obj.Key && IMAGE_EXT.test(obj.Key))
        .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
        .map((obj) => ({ name: obj.Key!, url: `${r2.publicUrl}/${obj.Key}` }));
      return NextResponse.json({ images });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? `R2 list failed: ${err.message}` : "R2 list failed" },
        { status: 500 }
      );
    }
  }

  if (!supabaseConfigured()) {
    const dir = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "../web/public/stickers");
    if (!fs.existsSync(dir)) return NextResponse.json({ images: [] });
    const images = fs
      .readdirSync(dir)
      .filter((name) => IMAGE_EXT.test(name))
      .map((name) => ({
        name,
        url: `/stickers/${name}`,
        mtime: fs.statSync(path.join(dir, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ name, url }) => ({ name, url }));
    return NextResponse.json({ images });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage.from("product-images").list("", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const images = (data ?? [])
    .filter((entry) => entry.name && IMAGE_EXT.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      url: supabase.storage.from("product-images").getPublicUrl(entry.name).data.publicUrl,
    }));
  return NextResponse.json({ images });
}
