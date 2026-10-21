import { imageAspectFromBytes, withSizePricing, type ProductInputParsed } from "@stickypie/shared";
import { imageSrc } from "./img";
import { makeThumb } from "./thumbs";

/** Reads the artwork's width / height from the image file header. */
export async function fetchImageAspect(imageUrl: string): Promise<number | null> {
  try {
    const res = await fetch(imageSrc(imageUrl), {
      headers: { Range: "bytes=0-65535" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ratio = imageAspectFromBytes(new Uint8Array(await res.arrayBuffer()));
    return ratio ? Math.round(ratio * 10000) / 10000 : null;
  } catch {
    return null;
  }
}

/**
 * Server-side touches before saving a product: the headline price mirrors the
 * cheapest size, the aspect ratio is filled in from the image when the form
 * didn't measure it, and a new/changed image gets a small card thumbnail.
 */
export async function prepareProductInput<T extends Partial<ProductInputParsed>>(
  input: T,
  existing?: { imageUrl: string; thumbUrl: string | null } | null
): Promise<T> {
  let next = withSizePricing(input);
  if (next.imageUrl && next.aspectRatio == null) {
    next = { ...next, aspectRatio: await fetchImageAspect(next.imageUrl) };
  }
  if (next.imageUrl) {
    const unchanged = existing && existing.imageUrl === next.imageUrl && existing.thumbUrl;
    if (unchanged) {
      const { thumbUrl: _keep, ...rest } = next;
      next = rest as T;
    } else {
      next = { ...next, thumbUrl: await makeThumb(next.imageUrl) };
    }
  }
  return next;
}
