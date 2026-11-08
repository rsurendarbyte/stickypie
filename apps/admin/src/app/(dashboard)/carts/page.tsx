import Link from "next/link";
import { formatDateTime, formatINR, orderCode } from "@stickypie/shared";
import StatusBadge from "@/components/status-badge";
import { type Cart, listCarts } from "@/lib/carts";
import { timeAgo } from "@/lib/customers";
import { imageSrc } from "@/lib/img";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carts" };

function CartCard({ cart }: { cart: Cart }) {
  const shopper = cart.name ?? cart.email ?? "Guest";
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-ink2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {cart.user_id ? (
            <Link href={`/customers/${cart.user_id}`} className="block truncate font-semibold hover:text-brand">
              {shopper}
            </Link>
          ) : (
            <p className="font-semibold">{shopper}</p>
          )}
          {cart.name && cart.email && <p className="truncate text-xs text-fog">{cart.email}</p>}
          {cart.phone && (
            <a href={`tel:${cart.phone}`} className="block truncate text-xs text-fog hover:text-brand">
              {cart.phone}
            </a>
          )}
          <p className="mt-0.5 text-xs text-fog" title={formatDateTime(cart.updated_at)}>
            {cart.place && <>{cart.place} · </>}Updated {timeAgo(cart.updated_at)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">{formatINR(cart.value)}</p>
          <p className="text-xs text-fog tabular-nums">
            {cart.item_count} item{cart.item_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-t border-line/50 pt-3">
        {cart.items.map((line, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            {line.thumb ? (
              <img src={imageSrc(line.thumb)} alt="" className="size-10 shrink-0 rounded-lg bg-white/5 object-contain" />
            ) : (
              <span className="size-10 shrink-0 rounded-lg bg-white/5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate">{line.name}</p>
              {line.size && <p className="truncate text-xs text-fog">{line.size}</p>}
            </div>
            <p className="shrink-0 text-xs text-fog tabular-nums">
              {line.qty} × {formatINR(line.price)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        {cart.status === "pending" && cart.order_id ? (
          // Filled in the checkout and started an order, but hasn't paid.
          <span className="inline-block rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
            Reached payment · not paid
          </span>
        ) : cart.status === "pending" ? (
          <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
            Pending
          </span>
        ) : cart.order_status ? (
          <StatusBadge status={cart.order_status} />
        ) : (
          <span className="text-xs text-fog">Ordered</span>
        )}
        {cart.order_id && (
          <Link href={`/orders/${cart.order_id}`} className="text-xs font-semibold text-snow hover:text-brand">
            {orderCode(cart.order_id)}
          </Link>
        )}
      </div>
    </article>
  );
}

export default async function CartsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const ordered = show === "ordered";

  let carts: Cart[];
  try {
    carts = await listCarts();
  } catch (e) {
    return (
      <div className="w-full">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Carts</h1>
        <p className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-5 text-sm">
          Could not load carts: {(e as Error).message}
          <br />
          <span className="text-fog">If it says the function is missing, apply migration 20261105000001_carts.sql.</span>
        </p>
      </div>
    );
  }

  const pending = carts.filter((c) => c.status === "pending");
  const paid = carts.filter((c) => c.status === "ordered");
  const shown = ordered ? paid : pending;

  const chip = (isActive: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
      isActive
        ? "pie-gradient border-transparent text-white shadow-md shadow-brand/20"
        : "border-line bg-ink2 text-fog hover:border-fog/40 hover:text-snow"
    }`;

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Carts</h1>
      <p className="mt-1 text-sm text-fog">
        What shoppers have in their carts before paying. Pending carts aren&apos;t orders: nothing here is printed or
        counted as a sale. Carts go after 30 days without a change.
      </p>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        <Link href="/carts" prefetch={false} className={chip(!ordered)}>
          Pending ({pending.length})
        </Link>
        <Link href="/carts?show=ordered" prefetch={false} className={chip(ordered)}>
          Ordered ({paid.length})
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-ink2 py-12 text-center text-sm text-fog">No carts here yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((cart) => (
            <CartCard key={cart.id} cart={cart} />
          ))}
        </div>
      )}
    </div>
  );
}
