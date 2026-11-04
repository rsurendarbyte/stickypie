// When a poster is deleted, every wall set holding it takes a similar poster in
// the same spot, so the set keeps its layout, poster sizes and price, and an order
// never comes up a poster short. Wall setups also get a fresh picture.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { DataDriver, Product } from "@stickypie/shared";
import { imageSrc } from "./img";
import { r2Client, r2Config } from "./r2";
import { makeDisplay, makeThumb } from "./thumbs";

/** Sets that must never change on their own: 4x4 Garage runs in the Instagram reel ad. */
const LOCKED_SETS = ["4x4-garage-poster-pack"];
const NOT_FOR_WALLS = /festival|diwali|tvk/i;

const isCandidate = (p: Product) =>
  p.isActive && p.slug.endsWith("-mini-poster") && p.packItems.length === 0 && !p.tags.some((t) => NOT_FOR_WALLS.test(t));

const shared = (a: Product, b: Product, general: Set<string>) =>
  a.categoryIds.filter((id) => !general.has(id) && b.categoryIds.includes(id)).length;

/** Most alike first, then the poster in the fewest sets, so walls stay varied. */
export function pickReplacement(removed: Product, wall: Product, all: Product[], uses: Map<string, number>, general: Set<string>) {
  return all
    .filter((p) => isCandidate(p) && p.id !== removed.id && !wall.packItems.includes(p.id))
    .sort(
      (a, b) =>
        shared(b, removed, general) - shared(a, removed, general) ||
        (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0) ||
        a.slug.localeCompare(b.slug)
    )[0];
}

/** The set's picture with the new poster over the old one's spot. null when it has no spots to paint. */
async function repaint(wall: Product, index: number, poster: Product) {
  const spots = wall.tags.find((t) => t.startsWith("wall spots:"))?.slice(11).split(";");
  const r2 = r2Config();
  if (!r2 || !wall.tags.includes("wall setup") || !spots?.[index]) return null;
  const [x, y, w, h] = spots[index].split(",").map(Number);
  const download = async (url: string) => {
    const res = await fetch(imageSrc(url), { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load ${url}`);
    return Buffer.from(await res.arrayBuffer());
  };
  const sharpModule = "sharp"; // kept out of the Worker bundle
  const { default: sharp } = await import(/* webpackIgnore: true */ sharpModule);
  const picture = await download(wall.imageUrl);
  const { width } = await sharp(picture).metadata();
  const px = (percent: number) => Math.round((percent / 100) * width);
  // A touch larger than its spot, past the art's rounded corners, so none of the old poster shows.
  const [spotW, spotH] = [px(w), px(h)];
  const art = await sharp(await download(poster.displayUrl ?? poster.imageUrl))
    .resize(Math.round(spotW * 1.07), Math.round(spotH * 1.07), { fit: "cover" })
    .extract({ left: Math.round(spotW * 0.035), top: Math.round(spotH * 0.035), width: spotW, height: spotH })
    .toBuffer();
  const body = await sharp(picture).composite([{ input: art, left: px(x), top: px(y) }]).jpeg({ quality: 90 }).toBuffer();
  const key = `packs/${wall.slug}-${Date.now()}.jpg`;
  await r2Client(r2).send(
    new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: "image/jpeg", CacheControl: "public, max-age=31536000, immutable" })
  );
  const imageUrl = `${r2.publicUrl}/${key}`;
  return { imageUrl, thumbUrl: await makeThumb(imageUrl), displayUrl: await makeDisplay(imageUrl) };
}

/** Takes a poster out of every set holding it. Throws, changing nothing, if a locked set holds it. */
export async function swapOutOfWalls(driver: DataDriver, removed: Product) {
  const all = await driver.listProducts();
  const walls = all.filter((p) => p.packItems.includes(removed.id));
  const locked = walls.find((w) => LOCKED_SETS.includes(w.slug));
  if (locked) throw new Error(`"${removed.name}" is in ${locked.name}, which runs in your ad. Hide it instead of deleting it.`);

  const categories = await driver.listCategories();
  const general = new Set(categories.filter((c) => ["mini-posters", "poster-packs", "packs"].includes(c.slug)).map((c) => c.id));
  const uses = new Map<string, number>();
  for (const id of all.flatMap((p) => p.packItems)) uses.set(id, (uses.get(id) ?? 0) + 1);

  const swaps: { wall: string; poster: string }[] = [];
  for (const wall of walls) {
    const poster = pickReplacement(removed, wall, all, uses, general);
    if (!poster) throw new Error(`No poster left to replace it in ${wall.name}.`);
    const index = wall.packItems.indexOf(removed.id);
    const packItems = wall.packItems.map((id) => (id === removed.id ? poster.id : id));
    await driver.updateProduct(wall.id, { packItems, ...((await repaint(wall, index, poster)) ?? {}) });
    uses.set(poster.id, (uses.get(poster.id) ?? 0) + 1);
    swaps.push({ wall: wall.name, poster: poster.name });
  }
  return swaps;
}
