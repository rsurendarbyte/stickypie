import { CircleDot, LogIn, ShoppingBag, UserPlus, Users } from "lucide-react";
import CustomersTable, { type CustomerRow } from "@/components/customers-table";
import StatCard from "@/components/stat-card";
import { supabaseConfigured } from "@/lib/auth";
import { listCustomers, loginStatus, STATUS_TEXT, timeAgo } from "@/lib/customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Customers</h1>
        <p className="mt-6 rounded-2xl border border-line bg-ink2 py-12 text-center text-sm text-fog">
          Customer logins live in Supabase — not available in the local demo store.
        </p>
      </div>
    );
  }

  let customers;
  try {
    customers = await listCustomers();
  } catch (e) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Customers</h1>
        <p className="mt-6 rounded-2xl border border-brand/40 bg-brand/10 p-5 text-sm">
          Could not load customers: {(e as Error).message}
          <br />
          <span className="text-fog">If it says the function is missing, apply migration 20261103000002_admin_customers.sql.</span>
        </p>
      </div>
    );
  }

  const rows: CustomerRow[] = customers.map((c) => {
    const status = loginStatus(c);
    return {
      ...c,
      status,
      statusText: STATUS_TEXT[status],
      seenText: timeAgo(c.last_active_at),
      joinedText: timeAgo(c.created_at),
    };
  });

  const weekAgo = Date.now() - 7 * 86_400_000;
  const online = rows.filter((r) => r.status === "online").length;
  const signedIn = rows.filter((r) => r.status === "online" || r.status === "signed-in").length;
  const newThisWeek = rows.filter((r) => new Date(r.created_at).getTime() > weekAgo).length;
  const buyers = rows.filter((r) => r.paid_orders > 0).length;

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Customers</h1>
      <p className="mt-1 hidden text-sm text-fog sm:block">
        Everyone with a shop login. &ldquo;Online now&rdquo; = shop open in the last hour; &ldquo;Signed in&rdquo; = hasn&apos;t
        signed out on some device.
      </p>

      {/* Phones: one line (the filter chips carry the counts); bigger screens: cards */}
      <p className="mt-4 text-sm font-semibold sm:hidden">
        {rows.length} customers · <span className="text-mint">{online} online</span> · {newThisWeek} new this week
      </p>
      <div className="mt-5 hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-5">
        <StatCard label="Customers" value={String(rows.length)} icon={<Users className="size-4" />} />
        <StatCard label="Online now" value={String(online)} icon={<CircleDot className="size-4" />} />
        <StatCard label="Signed in" value={String(signedIn)} icon={<LogIn className="size-4" />} />
        <StatCard label="New this week" value={String(newThisWeek)} icon={<UserPlus className="size-4" />} />
        <StatCard
          label="Bought"
          value={String(buyers)}
          sub={rows.length ? `${Math.round((buyers / rows.length) * 100)}% of customers` : undefined}
          icon={<ShoppingBag className="size-4" />}
        />
      </div>

      <div className="mt-6">
        <CustomersTable customers={rows} />
      </div>
    </div>
  );
}
