import WallCostCalculator, { type CostWall } from "@/components/wall-cost-calculator";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Wall costs" };

export default async function WallCostsPage() {
  const driver = await getAdminDriver();
  const [products, costs] = await Promise.all([driver.listProducts(), driver.getWallCosts()]);

  const walls: CostWall[] = products
    .filter((p) => p.packItems.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.thumbUrl ?? p.imageUrl,
      price: p.price,
      hidden: !p.isActive,
      inches: p.packItems.map((_, i) => p.packSizes[i] ?? 6),
    }));

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Wall costs</h1>
      <p className="mt-1 text-sm text-fog">Enter what a sheet costs and see what every wall set costs to make.</p>
      <WallCostCalculator walls={walls} initial={costs} />
    </div>
  );
}
