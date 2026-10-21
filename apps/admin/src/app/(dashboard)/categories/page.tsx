import CategoriesManager from "@/components/categories-manager";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const driver = await getAdminDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts(),
  ]);

  const productCounts: Record<string, number> = {};
  for (const product of products) {
    for (const id of product.categoryIds) {
      productCounts[id] = (productCounts[id] ?? 0) + 1;
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Categories</h1>
      <p className="mt-1 text-sm text-fog">
        Each category becomes a row on the storefront home page.
      </p>
      <div className="mt-6">
        <CategoriesManager categories={categories} productCounts={productCounts} />
      </div>
    </div>
  );
}
