import Link from "next/link";
import { Plus } from "lucide-react";
import ProductsTable from "@/components/products-table";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const driver = await getAdminDriver();
  const [products, categories] = await Promise.all([
    driver.listProducts(),
    driver.listCategories(),
  ]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-fog">
            Toggle &quot;open for sale&quot;, manage stock, and add new drops.
          </p>
        </div>
        <Link
          href="/products/new"
          className="pie-gradient flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
        >
          <Plus className="size-4" /> Add product
        </Link>
      </div>

      <div className="mt-6">
        {/* descriptions aren't shown in the table; leaving them out keeps the page light */}
        <ProductsTable products={products.map((p) => ({ ...p, description: "" }))} categories={categories} />
      </div>
    </div>
  );
}
