import type { Metadata } from "next";
import { Suspense } from "react";
import FaqItem from "@/components/faq-item";
import JsonLd from "@/components/json-ld";
import PageLink from "@/components/page-link";
import BrowseClient from "@/components/browse-client";
import StickerLoader from "@/components/sticker-loader";
import { ProductLinks } from "@/components/seo-blocks";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { isWallSetOnly } from "@stickypie/shared";
import { isPoster } from "@/lib/poster";
import { faqStructuredData, itemListStructuredData, stickerFaq } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import { SURFACES } from "@/lib/surfaces";

// All stickers. Static shell: products load live in the browser (on-sale
// only) and search/sort happen client-side. ?q= and ?sort= canonicalize here.
// The grid is drawn in the browser, so the text, sticker links and questions
// below it are in the page's own HTML for Google and AI crawlers.
export const metadata: Metadata = pageMetadata({
  title: "Buy Stickers Online in India – Car, Bike & Laptop Vinyl Stickers",
  description:
    "Shop every StickyPie sticker — car and bike decals, laptop stickers, origin badges, warning labels and memes. Die-cut vinyl in several sizes, shipped across India.",
  path: "/stickers",
});

const linkCls = "text-snow underline-offset-2 hover:underline";

export default async function StickersPage() {
  const driver = getDriver();
  const [categories, products, facts] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
    loadShopFacts(),
  ]);
  const stickers = products.filter((p) => !isWallSetOnly(p) && !isPoster(p));
  const faq = stickerFaq(facts);

  return (
    <div className="min-h-screen w-full px-4 pt-[76px] pb-24 sm:px-8 sm:pt-24 lg:px-12 2xl:px-20">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "Stickers", item: absoluteUrl("/stickers") },
            ],
          },
          itemListStructuredData(products.filter((p) => !isWallSetOnly(p))),
          ...(faq.length ? [faqStructuredData(faq)] : []),
        ]}
      />
      <Suspense
        fallback={
          <>
            <h1 className="font-display text-2xl font-bold sm:text-4xl">All stickers</h1>
            <div className="grid min-h-[40vh] place-items-center">
              <StickerLoader size={56} />
            </div>
          </>
        }
      >
        <BrowseClient initial={{ categories, products: productSnapshot(products) }} />
      </Suspense>

      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Stickers online in India</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-fog">
          StickyPie has {stickers.length} die-cut vinyl sticker designs, printed to order and shipped to pin codes across India:{" "}
          <PageLink href="/car-stickers" className={linkCls}>car stickers</PageLink>,{" "}
          <PageLink href="/bike-stickers" className={linkCls}>bike stickers</PageLink>,{" "}
          <PageLink href="/laptop-stickers" className={linkCls}>laptop stickers</PageLink>,{" "}
          <PageLink href="/helmet-stickers" className={linkCls}>helmet stickers</PageLink> and{" "}
          <PageLink href="/bottle-stickers" className={linkCls}>water bottle stickers</PageLink>, plus origin badges, warning labels,
          memes and devotional stickers. Each one comes in several sizes. Want your own? Make{" "}
          <PageLink href="/custom-stickers" className={linkCls}>custom stickers</PageLink>,{" "}
          <PageLink href="/name-stickers" className={linkCls}>name stickers</PageLink> or{" "}
          <PageLink href="/qr-code-stickers" className={linkCls}>QR code stickers</PageLink>. Looking for something for the room? See{" "}
          <PageLink href="/wall-posters" className={linkCls}>wall posters</PageLink>.
        </p>
      </section>

      <nav aria-label="Stickers by where they go" className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-fog uppercase">Stickers by where they go</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SURFACES.map((s) => (
            <li key={s.slug}>
              <PageLink
                href={`/${s.slug}`}
                className="inline-block rounded-full border border-line bg-ink2/80 px-3.5 py-1.5 text-sm font-semibold text-snow hover:border-brand/50"
              >
                {s.name}
              </PageLink>
            </li>
          ))}
        </ul>
      </nav>

      <ProductLinks heading="All stickers" products={stickers} />

      {faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">Stickers: questions, answered</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
