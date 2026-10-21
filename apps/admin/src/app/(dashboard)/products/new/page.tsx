import ProductForm from "@/components/product-form";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const driver = await getAdminDriver();
  const categories = await driver.listCategories();

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">New product</h1>
      <p className="mt-1 text-sm text-fog">
        Upload the sticker art, set a price, and it goes live the moment you save (if &quot;open
        for sale&quot; is on).
      </p>
      <div className="mt-7">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
