import { notFound } from "next/navigation";
import ProductForm from "@/components/product-form";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driver = await getAdminDriver();
  const [product, categories] = await Promise.all([
    driver.getProductById(id),
    driver.listCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Edit product</h1>
      <p className="mt-1 text-sm text-fog">/{product.slug}</p>
      <div className="mt-7">
        <ProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}
