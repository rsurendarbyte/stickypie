import type { Metadata } from "next";
import FaqItem from "@/components/faq-item";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import PageLink from "@/components/page-link";
import SurfaceGrid from "@/components/surface-grid";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { itemListStructuredData, seoName } from "@/lib/seo";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import { SURFACES, allLandings, stickersForSurface, type Surface } from "@/lib/surfaces";

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

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
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
    ...(surface.faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: surface.faq.map(({ q, a }) => ({
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
        <PageLink href="/stickers" className="hover:text-snow">
          Stickers
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

      {popular.length > 0 && (
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

      {surface.faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">
            {surface.name}: questions, answered
          </h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {surface.faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}

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
    </div>
  );
}
