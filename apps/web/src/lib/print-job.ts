// Server-only: the printing person's job (/print-job/<key>). The link is made
// in the admin and works only while the order is paid — once it's packed the
// job is done and the link closes.
import type { Order, OrderItem } from "@stickypie/shared";
import { getDriver } from "./data";

export async function openPrintJob(token: string): Promise<Order | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const order = await getDriver().getOrderByPrintToken(token);
  return order && order.status === "paid" ? order : null;
}

/** The print files of one order line: catalogue / uploaded art = 1, avatar packs = each finished sheet, poster packs = each poster. */
export function itemFiles(item: OrderItem): string[] {
  if (item.packPosters?.length) return item.packPosters.flatMap((p) => (p.imageUrl ? [p.imageUrl] : []));
  if (item.customSpec?.kind === "avatar") return item.finishedFiles;
  if (item.customSpec) return []; // QR / name stickers are drawn in the browser
  return item.imageUrl ? [item.imageUrl] : [];
}
