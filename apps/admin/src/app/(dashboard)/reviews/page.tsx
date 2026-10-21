import ReviewsManager from "@/components/reviews-manager";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const driver = await getAdminDriver();
  const [reviews, products] = await Promise.all([driver.listReviews(), driver.listProducts()]);
  const productInfo = Object.fromEntries(
    products.map((p) => [p.id, { name: p.name, imageUrl: p.thumbUrl ?? p.imageUrl, slug: p.slug }])
  );
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Reviews</h1>
      <p className="mt-1 text-sm text-fog">
        Shoppers rate stickers after their order is delivered. Approved reviews show on the sticker page.
      </p>
      <div className="mt-6">
        <ReviewsManager initial={reviews} products={productInfo} />
      </div>
    </div>
  );
}
