import type { Metadata } from "next";
import FaqItem from "@/components/faq-item";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import PageLink from "@/components/page-link";
import { PosterTopics, ProductLinks } from "@/components/seo-blocks";
import SurfaceGrid from "@/components/surface-grid";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { POSTER_ADHESIVE, PUZZLE_POSTER_PRICES, formatINR } from "@stickypie/shared";
import { itemListStructuredData, lowestPrice, posterTopicFaq, seoName, wallPosterFaq } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import { SURFACES, allLandings, posterLabel, stickersForSurface, type Surface } from "@/lib/surfaces";

// "Where it goes" landing pages: /car-stickers, /bike-stickers, /laptop-stickers,
// /helmet-stickers, /bottle-stickers, plus a page per festival from the admin
// (Festivals), e.g. /kannada-rajyotsava-stickers — built at deploy, so a new
// festival's page appears with the next deploy. Anything else 404s.
export const dynamicParams = false;

async function landings(): Promise<Surface[]> {
  const driver = getDriver();
  const [festivals, categories] = await Promise.all([driver.getFestivals(), driver.listCategories()]);
  return allLandings(festivals, categories);
}

async function landingBySlug(slug: string): Promise<Surface | undefined> {
  return (await landings()).find((s) => s.slug === slug);
}

export async function generateStaticParams() {
  return (await landings()).map((s) => ({ surface: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surface: string }>;
}): Promise<Metadata> {
  const surface = await landingBySlug((await params).surface);
  if (!surface) return {};
  const base = pageMetadata({
    title: surface.title,
    description: surface.description,
    path: `/${surface.slug}`,
  });
  return { ...base, title: { absolute: `${surface.title} | StickyPie` } };
}

export default async function SurfacePage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  const surface = await landingBySlug((await params).surface);
  if (!surface) notFound();

  const driver = getDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
  ]);
  const { matched, others } = stickersForSurface(surface, products, categories);
  // A festival page lists only its own stickers (for Google too); the
  // where-it-goes pages fall back on everything, since vinyl fits them all.
  const listed = surface.when && matched.length ? matched : [...matched, ...others];
  const popular = listed.slice(0, 12);
  const posters = surface.posters;
  const hub = surface.slug === "wall-posters";
  const from = surface.puzzle ? Math.min(...Object.values(PUZZLE_POSTER_PRICES)) : lowestPrice(matched);
  // Poster prices move with the catalog, so those answers are built here.
  const priceFaq = posters && !hub && !surface.puzzle ? posterTopicFaq(posterLabel(surface), matched) : null;
  const faq = [
    ...surface.faq,
    ...(hub ? wallPosterFaq(await loadShopFacts()) : priceFaq ? [priceFaq] : []),
    ...(surface.puzzle ? puzzlePosterFaq(await driver.getPuzzlePercent()) : []),
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        posters
          ? {
              "@type": "ListItem",
              position: 1,
              name: hub ? "Home" : "Wall Posters",
              item: absoluteUrl(hub ? "/" : "/wall-posters"),
            }
          : {
              "@type": "ListItem",
              position: 1,
              name: "Stickers",
              item: absoluteUrl("/stickers"),
            },
        {
          "@type": "ListItem",
          position: 2,
          name: surface.name,
          item: absoluteUrl(`/${surface.slug}`),
        },
      ],
    },
    itemListStructuredData(listed),
    // a festival may not have questions yet
    ...(faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen w-full px-4 pt-24 pb-24 sm:px-8 lg:px-12 2xl:px-20">
      <JsonLd data={structuredData} />
      <nav className="text-xs text-fog">
        <PageLink href={posters ? (hub ? "/" : "/wall-posters") : "/stickers"} className="hover:text-snow">
          {posters ? (hub ? "Home" : "Wall posters") : "Stickers"}
        </PageLink>
        <span className="mx-1.5">/</span>
        <span>{surface.name}</span>
      </nav>
      <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
        {surface.name}
      </h1>
      {surface.when && (
        <p className="mt-1 text-sm font-semibold text-brand">Celebrated on {surface.when}</p>
      )}
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-fog">
        {surface.intro}
      </p>
      {posters && matched.length > 0 && (
        <p className="mt-1 text-sm font-semibold text-snow">
          {matched.length} designs{from !== null ? ` from ${formatINR(from)}` : ""}
        </p>
      )}
      {posters && <PosterTopics current={surface.slug} className="mt-4" />}

      <SurfaceGrid
        surface={surface}
        initial={{ categories, products: productSnapshot(products) }}
      />

      {surface.sections.length > 0 && (
      <section className="mt-16 grid max-w-5xl gap-8 md:grid-cols-2">
        {surface.sections.map((s) => (
          <div key={s.heading}>
            <h2 className="font-display text-xl font-bold">{s.heading}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-fog">
              {s.body}
            </p>
          </div>
        ))}
      </section>
      )}

      {posters && <ProductLinks heading={`All ${posterLabel(surface)}`} products={matched} />}

      {!posters && popular.length > 0 && (
        <section className="mt-12 max-w-5xl">
          <h2 className="font-display text-xl font-bold">
            Popular {surface.name.toLowerCase()}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {popular.map((p) => (
              <li key={p.id}>
                <PageLink
                  href={`/sticker/${p.slug}`}
                  className="inline-block rounded-full border border-line bg-ink2/80 px-3 py-1.5 text-sm text-fog hover:border-fog/40 hover:text-snow"
                >
                  {seoName(p)}
                </PageLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">
            {surface.name}: questions, answered
          </h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}

      {!posters && (
      <section className="mt-12">
        <h2 className="text-sm font-semibold tracking-wide text-fog uppercase">
          Stickers for everything else
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SURFACES.filter((s) => s.slug !== surface.slug).map((s) => (
            <li key={s.slug}>
              <PageLink
                href={`/${s.slug}`}
                className="inline-block rounded-full border border-line bg-ink2/80 px-3.5 py-1.5 text-sm font-semibold text-snow hover:border-brand/50"
              >
                {s.name}
              </PageLink>
            </li>
          ))}
          <li>
            <PageLink
              href="/stickers"
              className="inline-block rounded-full border border-line bg-ink2/80 px-3.5 py-1.5 text-sm font-semibold text-snow hover:border-brand/50"
            >
              All stickers
            </PageLink>
          </li>
        </ul>
      </section>
      )}
    </div>
  );
}

/** The puzzle posters page's answers (prices and the prize come from the shop's settings). */
function puzzlePosterFaq(percent: number): { q: string; a: string }[] {
  const small = formatINR(PUZZLE_POSTER_PRICES[6]);
  const big = formatINR(PUZZLE_POSTER_PRICES[9]);
  return [
    {
      q: "What is a puzzle poster?",
      a: "A mini poster printed as 9 cards that fit together into one big poster. Lay the cards out 3 by 3 on your wall and they join into a single picture: 9 cards of 4 × 6 in make a 12 × 18 in poster, and 9 cards of 6 × 9 in make an 18 × 27 in poster.",
    },
    {
      q: "How much does a puzzle poster cost?",
      a: `${small} for the 12 × 18 in puzzle poster (9 cards of 4 × 6 in) and ${big} for the 18 × 27 in puzzle poster (9 cards of 6 × 9 in), plus GST and shipping. Every mini poster on StickyPie can be ordered as a puzzle poster.`,
    },
    {
      q: "How do I win the puzzle discount?",
      a: `Open any puzzle poster and play its online puzzle: the poster is cut into 9 tiles and shuffled, and you swap tiles until it's whole again, usually in about 30 seconds. Solving it gives ${percent}% off the puzzle posters in one order for the next 24 hours, once per phone number and email. The prize is for puzzle posters only.`,
    },
    {
      q: "How do I put a puzzle poster on the wall?",
      a: `Each card comes with ${POSTER_ADHESIVE}. Start with the middle card, then add the cards around it so the edges line up.`,
    },
  ];
}
