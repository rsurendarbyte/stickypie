// Server-only: storing custom sticker artwork in Supabase Storage (service role).
import { CUSTOM_STICKER_BUCKET, CUSTOM_STICKER_MAX_BYTES } from "@stickypie/shared";
import { supabaseUrl } from "./mode";

function headers(contentType?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, ...(contentType ? { "Content-Type": contentType } : {}) };
}

/** Real file type from the first bytes (never trust the browser's label). */
function sniff(bytes: Uint8Array): { type: string; ext: string } | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

export class UploadError extends Error {}

export function customFileUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${CUSTOM_STICKER_BUCKET}/${path}`;
}

/** Saves the artwork under a random name; returns its storage path + public URL. */
export async function storeCustomFile(file: File): Promise<{ path: string; url: string }> {
  if (file.size > CUSTOM_STICKER_MAX_BYTES) throw new UploadError("That file is over 5 MB — please upload a smaller one.");
  if (file.size === 0) throw new UploadError("That file is empty.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new UploadError("Please upload a PNG, JPG or WebP image.");
  const month = new Date().toISOString().slice(0, 7);
  const path = `uploads/${month}/${crypto.randomUUID()}.${kind.ext}`;
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${CUSTOM_STICKER_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers(kind.type), "cache-control": "public, max-age=31536000, immutable" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`custom upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { path, url: customFileUrl(path) };
}

