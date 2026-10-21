import Link from "next/link";
import { AlertTriangle, IndianRupee, Package, ShoppingCart } from "lucide-react";
import { formatINR } from "@stickypie/shared";
import OrdersTable from "@/components/orders-table";
import StatCard from "@/components/stat-card";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const driver = await getAdminDriver();
  const [stats, recent] = await Promise.all([driver.stats(), driver.listOrders({ limit: 6 })]);

  const pending = stats.ordersByStatus.pending ?? 0;
  const paid = stats.ordersByStatus.paid ?? 0;
  const toFulfil = paid + (stats.ordersByStatus.packed ?? 0);

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-fog">What&apos;s moving at the sticker shop today.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatINR(stats.revenue)}
          sub={`${stats.itemsSold} sticker${stats.itemsSold === 1 ? "" : "s"} sold`}
          icon={<IndianRupee className="size-4" />}
        />
        <StatCard
          label="Orders"
          value={String(stats.totalOrders)}
          sub={
            <span>
              {toFulfil} to fulfil · {pending} payment pending
            </span>
          }
          icon={<ShoppingCart className="size-4" />}
        />
        <StatCard
          label="Live products"
          value={`${stats.activeProducts}/${stats.products}`}
          sub="open for sale / total"
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Stock alerts"
          value={String(stats.outOfStock + stats.lowStock)}
          sub={`${stats.outOfStock} out of stock · ${stats.lowStock} low`}
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Recent orders</h2>
        <Link href="/orders" className="text-xs text-brand hover:underline">
          View all →
        </Link>
      </div>
      <div className="mt-3">
        <OrdersTable orders={recent} />
      </div>
    </div>
  );
}
