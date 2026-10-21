import Link from "next/link";
import type { Order } from "@stickypie/shared";
import { formatDateTime, formatINR, orderCode } from "@stickypie/shared";
import StatusBadge from "./status-badge";

export default function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-ink2 py-12 text-center text-sm text-fog">
        No orders here yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-ink2">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] tracking-wide text-fog uppercase">
            <th className="px-4 py-3 font-semibold">Order</th>
            <th className="px-4 py-3 font-semibold">Placed</th>
            <th className="px-4 py-3 font-semibold">Customer</th>
            <th className="px-4 py-3 font-semibold">Items</th>
            <th className="px-4 py-3 text-right font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Payment</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-b border-line/50 transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/orders/${order.id}`}
                  className="font-semibold text-snow hover:text-brand"
                >
                  {orderCode(order.id)}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-fog">
                {formatDateTime(order.createdAt)}
              </td>
              <td className="max-w-[180px] px-4 py-3">
                <p className="truncate">{order.customerName}</p>
                <p className="truncate text-xs text-fog">{order.city}</p>
              </td>
              <td className="px-4 py-3 tabular-nums">
                {order.items.reduce((sum, item) => sum + item.quantity, 0)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {formatINR(order.total)}
              </td>
              <td className="px-4 py-3 text-xs text-fog">
                {order.paymentProvider === "cashfree" ? "Cashfree" : "Simulator"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
