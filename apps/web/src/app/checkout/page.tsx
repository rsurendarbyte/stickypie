import type { Metadata } from "next";
import CheckoutClient from "@/components/checkout-client";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const metadata: Metadata = { title: "Checkout", robots: PRIVATE_PAGE_ROBOTS };

export default function CheckoutPage() {
  return <CheckoutClient />;
}
