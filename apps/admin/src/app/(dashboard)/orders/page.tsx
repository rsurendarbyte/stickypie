import Link from "next/link";
import type { OrderStatus } from "@stickypie/shared";
import { ORDER_STATUSES, STATUS_LABELS } from "@stickypie/shared";
import OrdersTable from "@/components/orders-table";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const driver = await getAdminDriver();
  const all = await driver.listOrders();

  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const order of all) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }

  const active = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : null;
  const orders = active ? all.filter((o) => o.status === active) : all;

  const chip = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
      isActive
        ? "pie-gradient border-transparent text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-fog">
        Payments confirm automatically (Razorpay / Cashfree webhook and return flow). Move paid orders through
        packing and shipping here.
      </p>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        <Link href="/orders" prefetch={false} className={chip(!active)}>
          All ({all.length})
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/orders?status=${s}`} prefetch={false} className={chip(active === s)}>
            {STATUS_LABELS[s]} ({counts[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <OrdersTable orders={orders} />
      </div>
    </div>
  );
}
