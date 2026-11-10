import { isMiniPosterProduct, productSizes, type Product } from "@stickypie/shared";
import ReelStudio from "@/components/reel-studio";
import { getAdminDriver } from "@/lib/data";
import { imageSrc } from "@/lib/img";
import type { ReelProduct } from "@/lib/reel/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reel studio" };

export default async function ReelStudioPage() {
  const driver = await getAdminDriver();
  const [products, categories, pct] = await Promise.all([driver.listProducts(), driver.listCategories(), driver.getPuzzlePercent()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const big = (p: Product) => imageSrc(p.displayUrl ?? p.imageUrl);
  const small = (p: Product) => imageSrc(p.thumbUrl ?? p.imageUrl);
  const tag = (p: Product, key: string) => p.tags.find((t) => t.startsWith(`${key}:`))?.slice(key.length + 1) ?? null;

  const items: ReelProduct[] = products
    .filter((p) => p.packItems.length > 0 || isMiniPosterProduct(p))
    .map((p) => {
      const isWall = p.packItems.length > 0;
      const paint = (tag(p, "wall paint")?.split(",") ?? ["#e8e4dc", "#d9d4ca"]) as string[];
      const spots = tag(p, "wall spots")
        ?.split(";")
        .map((s) => s.split(",").map(Number) as [number, number, number, number])
        .filter((s) => s.length === 4 && s.every((n) => Number.isFinite(n)));
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        type: isWall ? "wall" : "poster",
        image: big(p),
        thumb: small(p),
        active: p.isActive,
        categories: p.categoryIds.map((id) => catName.get(id) ?? "").filter(Boolean),
        tags: p.tags,
        sizes: productSizes(p).map((s) => ({ inches: s.inches, price: s.price, was: s.compareAtPrice })),
        price: p.price,
        was: p.compareAtPrice,
        wall: isWall
          ? {
              feet: tag(p, "wall size"),
              paint: [paint[0] ?? "#e8e4dc", paint[1] ?? paint[0] ?? "#d9d4ca"],
              spots: spots && spots.length === p.packItems.length ? spots : null,
              posters: p.packItems.map((id, i) => {
                const poster = byId.get(id);
                return { image: poster ? small(poster) : "", inches: p.packSizes[i] ?? 6 };
              }).filter((x) => x.image),
            }
          : null,
      } satisfies ReelProduct;
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <div className="w-full">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Reel studio</h1>
      <p className="mt-1 text-sm text-fog">
        Pick a poster or wall set, pick a style, and download a 9:16 video with its caption, YouTube text and ad plan.
      </p>
      <ReelStudio products={items} pct={pct} />
    </div>
  );
}
