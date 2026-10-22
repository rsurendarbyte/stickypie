// GST tax invoice maths. Orders store GST added ON TOP of prices (gstAmount):
// each line's price is its taxable value and tax is rate % of it, with a
// round-off to the whole-rupee total. Older orders (gstAmount null) had prices
// that INCLUDED GST, so their taxable value is worked back from the amount paid.
// Same state as the seller → CGST + SGST, otherwise IGST. Shipping is a
// separate line at the same rate.
import { matchIndianState } from "./india";
import type { Order } from "./types";
import type { BusinessDetails } from "./shipping";

export type InvoiceLine = {
  description: string;
  hsn: string;
  quantity: number;
  /** Price per unit as charged (excl. GST on new orders, incl. GST on older ones). */
  unitPrice: number;
  /** Line total incl. GST. */
  amount: number;
  taxable: number;
  tax: number;
};

export type InvoiceTotals = {
  lines: InvoiceLine[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Whole-rupee rounding between taxable + tax and the amount paid. */
  roundOff: number;
  total: number;
  intraState: boolean;
  rate: number;
  /** true = GST was added on top of prices (newer orders). */
  gstOnTop: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeInvoice(
  order: Pick<Order, "items" | "shippingFee" | "total" | "state" | "gstAmount" | "gstRate">,
  business: BusinessDetails,
  sellerState: string | null
): InvoiceTotals {
  const onTop = order.gstAmount != null;
  const rate = onTop ? (order.gstRate ?? business.gstRate) : business.gstRate;
  const split = (amount: number) => {
    if (onTop) {
      const tax = r2((amount * rate) / 100);
      return { taxable: amount, tax, amount: r2(amount + tax) };
    }
    const taxable = r2(amount / (1 + rate / 100));
    return { taxable, tax: r2(amount - taxable) };
  };
  const lines: InvoiceLine[] = order.items.map((item) => {
    const amount = item.unitPrice * item.quantity;
    return {
      description: item.sizeInches ? `${item.name} — ${item.sizeInches}″ sticker` : `${item.name} sticker`,
      hsn: business.hsn,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount,
      ...split(amount),
    };
  });
  if (order.shippingFee > 0) {
    lines.push({
      description: "Shipping & handling",
      hsn: "996812",
      quantity: 1,
      unitPrice: order.shippingFee,
      amount: order.shippingFee,
      ...split(order.shippingFee),
    });
  }
  const taxable = r2(lines.reduce((s, l) => s + l.taxable, 0));
  const tax = r2(lines.reduce((s, l) => s + l.tax, 0));
  const buyer = matchIndianState(order.state) ?? order.state;
  const seller = sellerState ? (matchIndianState(sellerState) ?? sellerState) : null;
  const intraState = Boolean(seller && buyer === seller);
  const half = r2(tax / 2);
  return {
    lines,
    taxable,
    cgst: intraState ? half : 0,
    sgst: intraState ? r2(tax - half) : 0,
    igst: intraState ? 0 : tax,
    roundOff: r2(order.total - taxable - tax),
    total: order.total,
    intraState,
    rate,
    gstOnTop: onTop,
  };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
}

/** 1385 → "One Thousand Three Hundred Eighty Five Rupees Only" (Indian grouping). */
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `${parts.join(" ")} Rupees Only`;
}
