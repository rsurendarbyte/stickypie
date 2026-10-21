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

  // Shoppers see this while the catalog is empty (e.g. a fresh production
  // database before the first products are added in the admin).
  if (!hero) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-4 pt-20 text-center">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="size-16 -rotate-6 rounded-2xl shadow-lg shadow-amber-500/30"
        />
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Fresh stickers are on the way
        </h1>
        <p className="max-w-md text-fog">
          We&apos;re printing our first drop of die-cut vinyl stickers. Check back soon — or say
          hi in the meantime.
        </p>
        <Link
          href="/contact"
          className="mt-2 rounded-full border border-line bg-ink2 px-5 py-2 text-sm font-semibold transition-colors hover:border-brand/50 hover:text-brand"
        >
          Contact us
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
