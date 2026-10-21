import type { Metadata } from "next";
import AccountClient from "@/components/account-client";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const metadata: Metadata = { title: "My orders", robots: PRIVATE_PAGE_ROBOTS };

// Static shell: sign-in and the order list load in the browser straight from
// Supabase, where row-level security limits each shopper to their own orders.
export default function AccountPage() {
  return <AccountClient />;
}
