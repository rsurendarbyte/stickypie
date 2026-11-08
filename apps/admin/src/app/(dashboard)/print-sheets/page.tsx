import { orderCode } from "@stickypie/shared";
import WallSheetMaker, { type SheetWall } from "@/components/wall-sheet-maker";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Print sheets" };

export default async function PrintSheetsPage() {
  const driver = await getAdminDriver();
  const [products, orders] = await Promise.all([driver.listProducts(), driver.listOrders({ status: "paid" })]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const byFile = new Map(products.map((p) => [p.imageUrl, p]));
  const preview = (imageUrl: string) => byFile.get(imageUrl)?.thumbUrl ?? imageUrl;

  const walls: SheetWall[] = products
    .filter((p) => p.packItems.length > 0)
    .map((p) => ({
      key: `product:${p.id}`,
      name: p.name,
      order: null,
      quantity: 1,
      image: p.thumbUrl ?? p.imageUrl,
      posters: p.packItems.flatMap((id, i) => {
        const poster = byId.get(id);
        return poster ? [{ name: poster.name, imageUrl: poster.imageUrl, preview: preview(poster.imageUrl), inches: p.packSizes[i] ?? 6 }] : [];
      }),
    }));

  // Paid, not packed yet: walls with the shopper's own swaps, and single paper posters.
  const ordered: SheetWall[] = orders.flatMap((order) =>
    order.items.flatMap((item) => {
      const posters =
        item.packPosters ??
        (/\b(270|300) GSM|wall poster/i.test(item.sizeLabel ?? "") && item.imageUrl && item.sizeInches
          ? [{ name: item.name, imageUrl: item.imageUrl, inches: item.sizeInches }]
          : null);
      if (!posters?.length) return [];
      return [
        {
          key: `order:${item.id}`,
          name: item.name,
          order: orderCode(order.id),
          quantity: item.quantity,
          image: item.imageUrl ?? posters[0].imageUrl,
          posters: posters.map((p) => ({ ...p, preview: preview(p.imageUrl) })),
        },
      ];
    })
  );

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Print sheets</h1>
      <p className="mt-1 text-sm text-fog">
        Pick walls and they&apos;re arranged on 13 × 19 in (A3+) sheets. Each sheet gets a print PDF for the printing shop and
        a cut file for the Cricut.
      </p>
      <WallSheetMaker walls={walls} ordered={ordered} />
    </div>
  );
}
