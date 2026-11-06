// A wall set's picture is drawn from its posters. It only stores poster ids, so a
// new poster image reaches the wall on its own and just the picture needs redrawing.
// A poster on a wall can't be deleted. The admin can change a wall's posters by
// hand, but not while an order for it is open.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { packPosterSizes, type DataDriver, type Product } from "@stickypie/shared";
import { imageSrc } from "./img";
import { r2Client, r2Config } from "./r2";
import { arrangeWall } from "./wall-layout";
import { wallName } from "./wall-names";
import { makeDisplay, makeThumb } from "./thumbs";

const NOT_FOR_WALLS = /festival|diwali/i;
const HAND_PICK_ONLY = /tvk/i;

/** The admin can put these on a wall by hand. */
export const isPickable = (p: Product) =>
  p.isActive && p.slug.endsWith("-mini-poster") && p.packItems.length === 0 && !p.tags.some((t) => NOT_FOR_WALLS.test(t));

/** These can also land on a wall on their own, by randomizing or as a replacement. */
export const isCandidate = (p: Product) => isPickable(p) && !p.tags.some((t) => HAND_PICK_ONLY.test(t));

/** The walls holding this poster. */
export const wallsHolding = (all: Product[], posterId: string) => all.filter((p) => p.packItems.includes(posterId));

/**
 * The set's picture with new posters over the old ones' spots. An older pack's
 * picture is a collage whose spots don't line up with what's drawn on it, so it
 * only changes when every poster is given: then it starts on a bare painted
 * wall. null when there are no spots to paint.
 */
async function repaint(wall: Product, changes: { index: number; poster: Product }[]) {
  const spots = wall.tags.find((t) => t.startsWith("wall spots:"))?.slice(11).split(";");
  const r2 = r2Config();
  const collage = wall.tags.includes("wall collage");
  if (!r2 || !wall.tags.includes("wall setup") || !changes.every((c) => spots?.[c.index])) return null;
  if (collage && changes.length < spots!.length) return null;
  const download = async (url: string) => {
    const res = await fetch(imageSrc(url), { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load ${url}`);
    return Buffer.from(await res.arrayBuffer());
  };
  const sharpModule = "sharp"; // kept out of the Worker bundle
  const { default: sharp } = await import(/* webpackIgnore: true */ sharpModule);
  const paint = wall.tags.find((t) => t.startsWith("wall paint:"))?.slice(11).split(",") ?? ["#e8e4dc", "#d9d4ca"];
  const bareWall = () =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600"><defs><linearGradient id="w" x2="1" y2="1"><stop stop-color="${paint[0]}"/><stop offset="1" stop-color="${paint[1] ?? paint[0]}"/></linearGradient></defs><rect width="1600" height="1600" fill="url(#w)"/></svg>`
      )
    )
      .jpeg()
      .toBuffer();
  const picture = collage ? await bareWall() : await download(wall.imageUrl);
  const { width } = await sharp(picture).metadata();
  const px = (percent: number) => Math.round((percent / 100) * width);
  const layers = await Promise.all(
    changes.map(async ({ index, poster }) => {
      const [x, y, w, h] = spots![index].split(",").map(Number);
      // A touch larger than its spot, past the art's rounded corners, so none of the old poster shows.
      const [spotW, spotH] = [px(w), px(h)];
      const input = await sharp(await download(poster.displayUrl ?? poster.imageUrl))
        .resize(Math.round(spotW * 1.07), Math.round(spotH * 1.07), { fit: "cover" })
        .extract({ left: Math.round(spotW * 0.035), top: Math.round(spotH * 0.035), width: spotW, height: spotH })
        .toBuffer();
      if (!collage) return [{ input, left: px(x), top: px(y) }];
      const pad = 30;
      const shadow = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${spotW + pad * 2}" height="${spotH + pad * 2}"><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter><rect x="${pad}" y="${pad}" width="${spotW}" height="${spotH}" fill-opacity="0.34" filter="url(#s)"/></svg>`
        )
      )
        .png()
        .toBuffer();
      return [{ input: shadow, left: px(x) - pad + 4, top: px(y) - pad + 8 }, { input, left: px(x), top: px(y) }];
    })
  );
  const tags = collage ? { tags: wall.tags.filter((t) => t !== "wall collage") } : {};
  const body = await sharp(picture).composite(layers.flat()).jpeg({ quality: 90 }).toBuffer();
  const key = `packs/${wall.slug}-${Date.now()}.jpg`;
  await r2Client(r2).send(
    new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: body, ContentType: "image/jpeg", CacheControl: "public, max-age=31536000, immutable" })
  );
  const imageUrl = `${r2.publicUrl}/${key}`;
  // One retry: R2 uploads drop now and then, and a wall with no thumb loads its full picture on every card.
  const thumbUrl = (await makeThumb(imageUrl)) ?? (await makeThumb(imageUrl));
  return { imageUrl, thumbUrl, displayUrl: await makeDisplay(imageUrl), ...tags };
}

/**
 * Paints a poster's new image over its spot on every wall holding it. A wall that
 * can't be redrawn (or the hosted admin, which has no sharp) is listed in `failed`:
 * the poster is saved by then, and the wall's Refresh wall picture button still works.
 */
export async function redrawPosterOnWalls(driver: DataDriver, poster: Product) {
  const all = await driver.listProducts();
  const failed: string[] = [];
  let redrawn = 0;
  for (const wall of wallsHolding(all, poster.id)) {
    try {
      // An older pack's collage is only repainted whole.
      const changes = wall.tags.includes("wall collage")
        ? wall.packItems.flatMap((id, index) => {
            const p = id === poster.id ? poster : all.find((x) => x.id === id);
            return p ? [{ index, poster: p }] : [];
          })
        : [{ index: wall.packItems.indexOf(poster.id), poster }];
      const picture = await repaint(wall, changes);
      if (!picture) throw new Error("No picture to redraw");
      await driver.updateProduct(wall.id, picture);
      redrawn++;
    } catch {
      failed.push(wallName(wall.name));
    }
  }
  return { redrawn, failed };
}

/** Orders that still hold this wall: paid and not yet delivered. An unpaid checkout doesn't count, or an abandoned one would lock the wall for good. */
export async function openWallOrders(driver: DataDriver, wallId: string) {
  const orders = await driver.listOrders();
  return orders.filter((o) => ["paid", "packed", "shipped"].includes(o.status) && o.items.some((i) => i.productId === wallId));
}

/** A wall laid out afresh for new poster sizes. "wall collage" sends its picture back to a bare wall. */
function rearrange(wall: Product, packSizes: number[]) {
  const { spots, feet } = arrangeWall(packSizes);
  const count = packSizes.length;
  return {
    name: wall.name.replace(/\d+ Mini Poster Pack/, `${count} Mini Poster Pack`),
    description: wall.description.replace(/setup of \d+ posters, about .+? on your wall/, `setup of ${count} posters, about ${feet} on your wall`),
    tags: [
      ...wall.tags.filter((t) => !/^wall (spots:|size:|collage$)/.test(t)),
      "wall collage",
      `wall size:${feet}`,
      `wall spots:${spots.map((s) => s.join(",")).join(";")}`,
    ],
  };
}

/** Gives a wall its set of posters, spot for spot, and rebuilds its picture from them, so the two always match. */
export async function saveWallPosters(driver: DataDriver, wall: Product, packItems: string[], packSizes: number[]) {
  const open = await openWallOrders(driver, wall.id);
  if (open.length) throw new Error(`This wall has ${open.length} open order${open.length === 1 ? "" : "s"}. Change it after they are delivered.`);
  if (packSizes.length !== packItems.length) throw new Error("Each poster needs a size.");
  if (new Set(packItems).size !== packItems.length) throw new Error("Each poster can only be on the wall once.");
  const posters = await driver.getProductsByIds(packItems);
  const changes = packItems.map((id, index) => {
    const poster = posters.find((p) => p.id === id);
    if (!poster || (!wall.packItems.includes(id) && !isPickable(poster))) throw new Error("Pick only mini posters that are open for sale.");
    return { index, poster };
  });
  const fresh = packSizes.join() === packPosterSizes(wall).join() ? {} : rearrange(wall, packSizes);
  return driver.updateProduct(wall.id, { packItems, packSizes, ...fresh, ...((await repaint({ ...wall, ...fresh }, changes)) ?? {}) });
}
