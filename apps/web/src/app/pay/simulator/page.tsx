import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { formatINR, orderCode } from "@stickypie/shared";
import SimulatorButtons from "@/components/simulator-buttons";
import { getDriver } from "@/lib/data";
import { cashfreeConfigured } from "@/lib/mode";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Test payment", robots: PRIVATE_PAGE_ROBOTS };

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId || cashfreeConfigured()) notFound();

  const order = await getDriver().getOrder(orderId);
  if (!order) notFound();
  if (order.paymentProvider !== "simulator" || order.status !== "pending") {
    redirect(`/order/${order.id}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink2 p-6">
        <p className="flex items-center justify-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold tracking-wide text-gold uppercase">
          <FlaskConical className="size-4" /> Test mode — no real money moves
        </p>
        <p className="mt-5 text-center text-sm text-fog">
          Cashfree keys aren&apos;t configured, so StickyPie is using its built-in payment
          simulator. Order <span className="font-medium text-snow">{orderCode(order.id)}</span>
        </p>
        <p className="mt-4 text-center font-display text-5xl font-bold">
          {formatINR(order.total)}
        </p>
        <SimulatorButtons orderId={order.id} />
        <p className="mt-4 text-center text-[11px] text-fog/70">
          With CASHFREE_APP_ID &amp; CASHFREE_SECRET_KEY set, buyers see the real Cashfree
          checkout (UPI, cards, netbanking) instead of this page.
        </p>
      </div>
    </div>
  );
}
