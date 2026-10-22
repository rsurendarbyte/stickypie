import type { Metadata } from "next";
import FaqItem from "@/components/faq-item";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import HoverLink from "@/components/hover-link";
import SurfaceGrid from "@/components/surface-grid";
import { productSnapshot } from "@/lib/catalog-snapshot";
import { getDriver } from "@/lib/data";
import { itemListStructuredData, seoName } from "@/lib/seo";
import { absoluteUrl, pageMetadata } from "@/lib/site";
import { SURFACES, stickersForSurface, surfaceBySlug } from "@/lib/surfaces";

// "Where it goes" landing pages: /car-stickers, /bike-stickers, /laptop-stickers,
// /helmet-stickers, /bottle-stickers. Only these slugs exist; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return SURFACES.map((s) => ({ surface: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surface: string }>;
}): Promise<Metadata> {
  const surface = surfaceBySlug((await params).surface);
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
  const surface = surfaceBySlug((await params).surface);
  if (!surface) notFound();

  const driver = getDriver();
  const [categories, products] = await Promise.all([
    driver.listCategories(),
    driver.listProducts({ activeOnly: true }),
  ]);
  const { matched, others } = stickersForSurface(surface, products, categories);
  const listed = [...matched, ...others];
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
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: surface.faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return (
    <div className="min-h-screen w-full px-4 pt-24 pb-24 sm:px-8 lg:px-12 2xl:px-20">
      <JsonLd data={structuredData} />
      <nav className="text-xs text-fog">
        <HoverLink href="/stickers" className="hover:text-snow">
          Stickers
        </HoverLink>
        <span className="mx-1.5">/</span>
        <span>{surface.name}</span>
      </nav>
      <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
        {surface.name}
      </h1>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-fog">
        {surface.intro}
      </p>

      <SurfaceGrid
        slug={surface.slug}
        initial={{ categories, products: productSnapshot(products) }}
      />

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

      {popular.length > 0 && (
        <section className="mt-12 max-w-5xl">
          <h2 className="font-display text-xl font-bold">
            Popular {surface.name.toLowerCase()}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {popular.map((p) => (
              <li key={p.id}>
                <HoverLink
                  href={`/sticker/${p.slug}`}
                  className="inline-block rounded-full border border-line bg-ink2/80 px-3 py-1.5 text-sm text-fog hover:border-fog/40 hover:text-snow"
                >
                  {seoName(p)}
                </HoverLink>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      <section className="mt-12">
        <h2 className="text-sm font-semibold tracking-wide text-fog uppercase">
          Stickers for everything else
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {SURFACES.filter((s) => s.slug !== surface.slug).map((s) => (
            <li key={s.slug}>
              <HoverLink
                href={`/${s.slug}`}
                className="inline-block rounded-full border border-line bg-ink2/80 px-3.5 py-1.5 text-sm font-semibold text-snow hover:border-brand/50"
              >
                {s.name}
              </HoverLink>
            </li>
          ))}
          <li>
            <HoverLink
              href="/stickers"
              className="inline-block rounded-full border border-line bg-ink2/80 px-3.5 py-1.5 text-sm font-semibold text-snow hover:border-brand/50"
            >
              All stickers
            </HoverLink>
          </li>
        </ul>
      </section>
    </div>
  );
}
