import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";
import { formatDateTime, orderCode } from "@stickypie/shared";
import PrintJob, { type JobItem } from "@/components/print-job";
import { itemFiles, openPrintJob } from "@/lib/print-job";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print job", robots: PRIVATE_PAGE_ROBOTS };

/**
 * The printing person's job sheet: what to print, how many, which size, the
 * files and ready-made A3 sheets. No prices, no customer details.
 */
export default async function PrintJobPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await openPrintJob(token);
  if (!order) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 pt-20 text-center">
        <PackageCheck className="size-12 text-fog" />
        <h1 className="mt-3 font-display text-2xl font-bold">This print job is closed</h1>
        <p className="mt-1 text-sm text-fog">The order has been packed, or the link was switched off. Thank you!</p>
      </div>
    );
  }

  const items: JobItem[] = order.items.map((i) => {
    const spec = i.customSpec;
    return {
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      sizeInches: i.sizeInches,
      sizeLabel: i.sizeLabel,
      files: itemFiles(i).length,
      drawn: spec && spec.kind !== "avatar" ? spec : null,
      avatarPacks: spec?.kind === "avatar" ? spec.pages : null,
    };
  });

  return (
    <PrintJob
      token={token}
      code={orderCode(order.id)}
      placed={formatDateTime(order.paidAt ?? order.createdAt)}
      items={items}
    />
  );
}
