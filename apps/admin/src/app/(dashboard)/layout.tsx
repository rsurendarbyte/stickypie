import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "@/lib/auth";
import { OrderAlertsProvider } from "@/components/order-alerts";
import { isAuthedAdmin, sessionLabel } from "@/lib/data";
import { logout } from "../login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthedAdmin())) redirect("/login");
  const label = await sessionLabel();

  return (
    // New-order alerts (live + backup check) around the whole panel.
    <OrderAlertsProvider
      supabaseUrl={supabaseConfigured() ? supabaseUrl() : undefined}
      supabaseAnonKey={supabaseConfigured() ? supabaseAnonKey() : undefined}
    >
      <div className="min-h-screen">
        <Sidebar
          mode={supabaseConfigured() ? "supabase" : "demo"}
          userLabel={label}
          logout={logout}
        />
        <main className="min-w-0 px-4 py-6 sm:px-7 lg:ml-60 lg:py-8">{children}</main>
      </div>
    </OrderAlertsProvider>
  );
}
