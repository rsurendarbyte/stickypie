// Small WebP card images. Cards show ~200px stickers, so shipping the full
// 1–2 MB artwork to every card wastes bandwidth; the product page keeps the
// full image. Same settings as scripts/build-thumbs.mjs (the backfill).
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { imageSrc } from "./img";
import { r2Client, r2Config } from "./r2";

export const THUMB_MAX_PX = 480;
const THUMB_QUALITY = 80;

/** Resizes the artwork and uploads it to R2. null when R2 isn't set up or it fails. */
export async function makeThumb(imageUrl: string): Promise<string | null> {
  const r2 = r2Config();
  if (!r2 || !imageUrl) return null;
  try {
    const res = await fetch(imageSrc(imageUrl), { cache: "no-store" });
    if (!res.ok) return null;
    const { default: sharp } = await import("sharp");
    const webp = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, alphaQuality: 90 })
      .toBuffer();
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
