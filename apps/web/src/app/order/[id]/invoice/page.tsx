import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileClock } from "lucide-react";
import { computeInvoice, formatINR, orderCode, rupeesInWords } from "@stickypie/shared";
import PrintButton from "@/components/print-button";
import { getDriver } from "@/lib/data";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GST invoice", robots: PRIVATE_PAGE_ROBOTS };

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = getDriver();
  const [order, settings] = await Promise.all([driver.getOrder(id), driver.getSettings()]);
  if (!order) notFound();

  const business = settings.business;
  // Tax invoices exist only after delivery (number assigned then) and once the
  // seller's GSTIN is configured.
  if (order.status !== "delivered" || !order.invoiceNumber || !order.invoiceDate || !business.gstin) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 pt-20 text-center">
        <FileClock className="size-12 text-fog" />
        <h1 className="mt-3 font-display text-2xl font-bold">Invoice not ready yet</h1>
        <p className="mt-1 text-sm text-fog">
          Your GST invoice can be downloaded once your order has been delivered.
        </p>
        <Link href={`/order/${order.id}`} className="mt-4 text-sm font-semibold text-brand hover:underline">
          ← Back to order {orderCode(order.id)}
        </Link>
      </div>
    );
  }

  const inv = computeInvoice(order, business, settings.originState);
  const half = inv.rate / 2;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pt-24 pb-16 sm:px-8">
      <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/order/${order.id}`} className="text-sm font-semibold text-brand hover:underline">
          ← Back to order
        </Link>
        <PrintButton label="Download PDF / Print" />
      </div>

      <article className="invoice-print rounded-2xl border border-line bg-white p-6 text-[13px] leading-relaxed text-[#15161e] shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-192.png" alt="" className="size-12 rounded-xl" />
            <div>
              <p className="font-display text-lg font-bold">{business.name ?? "StickyPie"}</p>
              {business.address && <p className="max-w-xs whitespace-pre-line text-xs text-[#64708a]">{business.address}</p>}
              <p className="mt-1 text-xs">
                <span className="font-semibold">GSTIN:</span> {business.gstin}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold tracking-wide">TAX INVOICE</p>
            <p className="mt-1 text-xs">
              <span className="text-[#64708a]">Invoice no.</span> <b>{order.invoiceNumber}</b>
            </p>
            <p className="text-xs">
              <span className="text-[#64708a]">Invoice date</span> {date(order.invoiceDate)}
            </p>
            <p className="text-xs">
              <span className="text-[#64708a]">Order</span> {orderCode(order.id)} · {date(order.createdAt)}
            </p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-line py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-semibold tracking-widest text-[#64708a] uppercase">Billed &amp; shipped to</p>
            <p className="mt-1 font-semibold">{order.customerName}</p>
            <p className="text-xs">
              {order.address1}
              {order.address2 ? `, ${order.address2}` : ""}
              <br />
              {order.city}, {order.state} — {order.pincode}
              <br />
              {order.phone} · {order.email}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10.5px] font-semibold tracking-widest text-[#64708a] uppercase">Place of supply</p>
            <p className="mt-1 font-semibold">{order.state}</p>
            <p className="text-xs text-[#64708a]">{inv.intraState ? "Intra-state supply (CGST + SGST)" : "Inter-state supply (IGST)"}</p>
            {order.cfPaymentId && <p className="mt-1 text-xs">Paid online · Ref {order.cfPaymentId}</p>}
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="mt-4 w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] tracking-wider text-[#64708a] uppercase">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pr-2">HSN/SAC</th>
                <th className="py-2 pr-2 text-right">Qty</th>
                <th className="py-2 pr-2 text-right">Rate</th>
                <th className="py-2 pr-2 text-right">Taxable value</th>
                <th className="py-2 pr-2 text-right">GST {inv.rate}%</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((line, i) => (
                <tr key={i} className="border-b border-line/70 align-top">
                  <td className="py-2 pr-2">{i + 1}</td>
                  <td className="py-2 pr-2">{line.description}</td>
                  <td className="py-2 pr-2">{line.hsn}</td>
                  <td className="py-2 pr-2 text-right">{line.quantity}</td>
                  <td className="py-2 pr-2 text-right">{money(line.unitPrice)}</td>
                  <td className="py-2 pr-2 text-right">{money(line.taxable)}</td>
                  <td className="py-2 pr-2 text-right">{money(line.tax)}</td>
                  <td className="py-2 text-right font-semibold">{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <p className="max-w-sm text-xs">
            <span className="text-[#64708a]">Amount in words:</span>
            <br />
            <b>{rupeesInWords(inv.total)}</b>
          </p>
          <dl className="w-full max-w-[280px] space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-[#64708a]">Taxable value</dt>
              <dd>₹{money(inv.taxable)}</dd>
            </div>
            {inv.intraState ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-[#64708a]">CGST @ {half}%</dt>
                  <dd>₹{money(inv.cgst)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#64708a]">SGST @ {half}%</dt>
                  <dd>₹{money(inv.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-[#64708a]">IGST @ {inv.rate}%</dt>
                <dd>₹{money(inv.igst)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5 text-sm font-bold">
              <dt>Total (incl. GST)</dt>
              <dd>{formatINR(inv.total)}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-[11px] text-[#64708a]">
          Prices include GST. This is a computer-generated invoice and does not require a signature.
        </footer>
      </article>
    </div>
  );
}
