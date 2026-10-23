// Derived WebP renditions of the artwork, uploaded to R2:
//   thumb   (480px,  thumbs/)   — product cards, which show ~200px stickers.
//   display (1024px, display/)  — hero and product-page art: sharp on the
//     biggest stage at 2× pixel density, a fraction of the full PNG's weight.
// The full image stays the master file and the true-size zoom. Same settings
// as scripts/build-thumbs.mjs (the backfill).
//
// Resizing: on Cloudflare the Worker's Images binding does it (sharp is a
// native module and can't run there); locally sharp does.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { imageSrc } from "./img";
import { r2Client, r2Config } from "./r2";

export const THUMB_MAX_PX = 480;
export const DISPLAY_MAX_PX = 1024;
const RENDITIONS = {
  thumb: { maxPx: THUMB_MAX_PX, quality: 80, prefix: "thumbs" },
  display: { maxPx: DISPLAY_MAX_PX, quality: 82, prefix: "display" },
} as const;
type Rendition = keyof typeof RENDITIONS;

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

async function toWebp(bytes: ArrayBuffer, maxPx: number, quality: number): Promise<Uint8Array> {
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

/** Resizes the artwork and uploads it to R2. null when R2 isn't set up or it fails. */
async function makeRendition(imageUrl: string, kind: Rendition): Promise<string | null> {
  const r2 = r2Config();
  if (!r2 || !imageUrl) return null;
  const { maxPx, quality, prefix } = RENDITIONS[kind];
  try {
    const res = await fetch(imageSrc(imageUrl), { cache: "no-store" });
    if (!res.ok) return null;
    const webp = await toWebp(await res.arrayBuffer(), maxPx, quality);
    const base =
      (imageUrl.split("/").pop() ?? "sticker").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-") ||
      "sticker";
    const key = `${prefix}/${base}-${maxPx}-${Date.now()}.webp`;
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
    console.error(`[thumbs] could not make the ${kind} image:`, err);
    return null;
  }
}

/** Small card thumbnail. */
export const makeThumb = (imageUrl: string) => makeRendition(imageUrl, "thumb");
/** Mid-size hero / product-page art. */
export const makeDisplay = (imageUrl: string) => makeRendition(imageUrl, "display");
