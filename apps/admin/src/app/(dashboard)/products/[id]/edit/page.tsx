import { notFound } from "next/navigation";
import { orderCode } from "@stickypie/shared";
import ProductForm from "@/components/product-form";
import WallPosterEditor from "@/components/wall-poster-editor";
import { getAdminDriver } from "@/lib/data";
import { wallName } from "@/lib/wall-names";
import { isCandidate, isPickable, openWallOrders, wallsHolding } from "@/lib/wall-reshuffle";

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
  const isWall = product.packItems.length > 0;
  const [all, open] = await Promise.all([driver.listProducts(), isWall ? openWallOrders(driver, id) : []]);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Edit product</h1>
      <p className="mt-1 text-sm text-fog">/{product.slug}</p>
      {isWall && (
        <div className="mt-6">
          <WallPosterEditor
            wall={product}
            posters={all
              .filter((p) => isPickable(p) || product.packItems.includes(p.id))
              .map((p) => ({ id: p.id, name: p.name, image: p.thumbUrl ?? p.imageUrl, printImage: p.imageUrl, categoryIds: p.categoryIds, handPickOnly: isPickable(p) && !isCandidate(p) }))}
            categories={categories}
            openOrders={open.map((o) => ({ id: o.id, code: orderCode(o.id) }))}
          />
        </div>
      )}
      <div className="mt-7">
        <ProductForm key={product.packItems.length} categories={categories} product={product} walls={wallsHolding(all, id).map((w) => wallName(w.name))} />
      </div>
    </div>
  );
}
