"use client";

// Shrinks a photo in the browser before upload: longest side ≤ maxSide, WebP
// (JPEG where WebP encoding isn't supported), quality stepped down until it
// fits maxBytes. Phone photos (4–10 MB) usually end up around 100–250 KB.
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file); // honours EXIF orientation
    } catch {
      // fall through (e.g. a format this browser can't decode via bitmap)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function shrinkImage(file: File, maxSide = 1200, maxBytes = 900_000): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo (JPG, PNG or WebP).");
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("That photo couldn't be opened — try a JPG or PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this photo.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let blob = await toBlob(canvas, "image/webp", quality);
  const type = blob?.type === "image/webp" ? "image/webp" : "image/jpeg";
  if (type === "image/jpeg") blob = await toBlob(canvas, type, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await toBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("Your browser couldn't process this photo.");
  if (blob.size > maxBytes) throw new Error("That photo is too large even after shrinking — try another one.");
  return new File([blob], type === "image/webp" ? "review.webp" : "review.jpg", { type });
}
