// Small WebP card images. Cards show ~200px stickers, so shipping the full
// 1–2 MB artwork to every card wastes bandwidth; the product page keeps the
// full image. Same settings as scripts/build-thumbs.mjs (the backfill).
//
// Resizing: on Cloudflare the Worker's Images binding does it (sharp is a
// native module and can't run there); locally sharp does.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { imageSrc } from "./img";
import { r2Client, r2Config } from "./r2";

export const THUMB_MAX_PX = 480;
const THUMB_QUALITY = 80;

type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(opts: { width: number; height: number; fit: "scale-down" }): {
      output(opts: { format: "image/webp"; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

/** The Worker's Cloudflare Images binding, or null when running under Node. */
async function imagesBinding(): Promise<ImagesBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return (getCloudflareContext().env as { IMAGES?: ImagesBinding }).IMAGES ?? null;
  } catch {
    return null;
  }
}

/** Resizes to fit maxPx and encodes as WebP (also used by the upload route). */
export async function toWebp(bytes: ArrayBuffer, maxPx: number, quality: number): Promise<Uint8Array> {
  const images = await imagesBinding();
  if (images) {
    const out = await images
      .input(new Response(bytes).body!)
      .transform({ width: maxPx, height: maxPx, fit: "scale-down" })
      .output({ format: "image/webp", quality });
    return new Uint8Array(await out.response().arrayBuffer());
  }
  const sharpModule = "sharp"; // kept out of the Worker bundle
  const { default: sharp } = await import(/* webpackIgnore: true */ sharpModule);
  return sharp(Buffer.from(bytes))
    .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
    .webp({ quality, alphaQuality: 90 })
    .toBuffer();
}

const toWebpThumb = (bytes: ArrayBuffer) => toWebp(bytes, THUMB_MAX_PX, THUMB_QUALITY);

/** Resizes the artwork and uploads it to R2. null when R2 isn't set up or it fails. */
export async function makeThumb(imageUrl: string): Promise<string | null> {
  const r2 = r2Config();
  if (!r2 || !imageUrl) return null;
  try {
    const res = await fetch(imageSrc(imageUrl), { cache: "no-store" });
    if (!res.ok) return null;
    const webp = await toWebpThumb(await res.arrayBuffer());
    const base =
      (imageUrl.split("/").pop() ?? "sticker").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-") ||
      "sticker";
    const key = `thumbs/${base}-${THUMB_MAX_PX}-${Date.now()}.webp`;
    await r2Client(r2).send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${r2.publicUrl}/${key}`;
  } catch (err) {
    console.error("[thumbs] could not make a thumbnail:", err);
    return null;
  }
}
