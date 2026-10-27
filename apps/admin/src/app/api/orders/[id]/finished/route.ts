import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { CUSTOM_STICKER_BUCKET, CUSTOM_STICKER_MAX_BYTES } from "@stickypie/shared";
import { supabaseConfigured } from "@/lib/auth";
import { requireAdminApi } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase";

const TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };

/**
 * Finished avatar sticker book pages for an order line (previews for the shopper). Stored in the custom-stickers
 * bucket under finished/ (Supabase Storage sends CORS headers, so the order
 * page can draw them into a share image); demo mode writes to the storefront's
 * public folder.
 */
async function store(orderId: string, file: File): Promise<string> {
  const name = `finished/${orderId}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  if (!supabaseConfigured()) {
    const dir = path.resolve(process.cwd(), "../web/public");
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return `/${name}`;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage
    .from(CUSTOM_STICKER_BUCKET)
    .upload(name, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(CUSTOM_STICKER_BUCKET).getPublicUrl(name).data.publicUrl;
}

/** Adds finished pages (multipart: itemId + one or more files). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const order = await auth.driver.getOrder(id);
  const form = await req.formData().catch(() => null);
  const item = order?.items.find((i) => i.id === form?.get("itemId"));
  if (!order || item?.customSpec?.kind !== "avatar") {
    return NextResponse.json({ error: "Avatar sticker book not found on this order" }, { status: 404 });
  }
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "Choose the sticker files" }, { status: 400 });
  for (const f of files) {
    if (!TYPES[f.type]) return NextResponse.json({ error: `${f.name}: use PNG, WebP or JPG` }, { status: 400 });
    if (f.size > CUSTOM_STICKER_MAX_BYTES) return NextResponse.json({ error: `${f.name}: max 5 MB — save a smaller preview` }, { status: 400 });
  }

  try {
    const urls = [...item.finishedFiles];
    for (const f of files) urls.push(await store(order.id, f));
    await auth.driver.setFinishedFiles(order.id, item.id, urls);
    return NextResponse.json({ urls });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}

/** Replaces the list (used to remove a page): { itemId, urls }. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { itemId?: string; urls?: unknown } | null;
  const order = await auth.driver.getOrder(id);
  const item = order?.items.find((i) => i.id === body?.itemId);
  if (!order || item?.customSpec?.kind !== "avatar") {
    return NextResponse.json({ error: "Avatar sticker book not found on this order" }, { status: 404 });
  }
  // Only removals: every URL must already be on the line.
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => item.finishedFiles.includes(u as string)) : [];
  try {
    await auth.driver.setFinishedFiles(order.id, item.id, urls);
    return NextResponse.json({ urls });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save" }, { status: 500 });
  }
}
