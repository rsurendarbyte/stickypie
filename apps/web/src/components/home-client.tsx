"use client";

import Link from "next/link";
import Hero from "./hero";
import ProductCard from "./product-card";
import Row from "./row";
import { useLiveCatalog, type Catalog } from "@/lib/live-catalog";

export default function HomeClient({ initial }: { initial: Catalog }) {
  const { categories, products } = useLiveCatalog(initial);

  const featured = products.filter((p) => p.featured);
  const hero = featured[0] ?? products[0];
  const topPicks = featured.slice(0, 10);
  const newDrops = products.slice(0, 10);
  const categoryRows = categories
    .map((category) => ({
      category,
      items: products.filter((p) => p.categoryId === category.id),
    }))
    .filter((row) => row.items.length > 0);

  if (!hero) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-display text-2xl font-semibold">The shelf is empty</p>
        <p className="text-sm text-fog">Add products from the admin console to open the store.</p>
        <Link href="/browse" className="text-sm text-brand hover:underline">
          Browse
        </Link>
      </div>
    );
  }

  return (
    <>
      <Hero products={featured.length > 0 ? featured : [hero]} categories={categories} />
      <div className="relative z-10 mt-2 space-y-10 pb-24">
        {topPicks.length > 0 && (
          <Row title="Top Picks This Week">
            {topPicks.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Row>
        )}
        <Row title="New Drops" href="/browse?sort=new">
          {newDrops.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Row>
        {categoryRows.map(({ category, items }) => (
          <Row
            key={category.id}
            title={category.name}
            href={`/browse?category=${category.slug}`}
          >
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Row>
        ))}
      </div>
    </>
  );
}
