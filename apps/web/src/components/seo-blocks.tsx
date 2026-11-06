// Server-rendered text blocks that give each page real, readable content for
// shoppers and search engines (details, how-to, FAQ). No client JS.
import FaqItem from "@/components/faq-item";
import Link from "@/components/page-link";
import { seoName, type Faq } from "@/lib/seo";
import { POSTER_SURFACES } from "@/lib/surfaces";
import type { Product } from "@stickypie/shared";

export function ProductAbout({
  heading,
  intro,
  facts,
  tips,
}: {
  heading: string;
  intro: string;
  facts: [string, string][];
  tips: string;
}) {
  return (
    <section
      aria-labelledby="about-sticker"
      className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12"
    >
      <div>
        <h2 id="about-sticker" className="font-display text-2xl font-bold">
          {heading}
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fog">
          {intro}
        </p>
        <h3 className="mt-6 font-display text-lg font-bold">How to apply it</h3>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-fog">
          {tips}
        </p>
      </div>
      <dl className="divide-y divide-line self-start rounded-2xl border border-line bg-ink2/80">
        {facts.map(([term, value]) => (
          <div
            key={term}
            className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3 text-sm"
          >
            <dt className="font-semibold text-snow">{term}</dt>
            <dd className="text-fog">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CategoryAbout({
  heading,
  text,
}: {
  heading: string;
  text: string;
}) {
  return (
    <section className="mt-16 max-w-3xl">
      <h2 className="font-display text-xl font-bold">{heading}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-fog">{text}</p>
    </section>
  );
}

/**
 * Links to the wall poster subject pages, in the page's own HTML. On a phone
 * they stay on one line and slide sideways.
 */
export function PosterTopics({ current, className = "" }: { current?: string; className?: string }) {
  return (
    <nav aria-label="Wall posters by subject" className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}>
      {POSTER_SURFACES.map((s) => (
        <Link
          key={s.slug}
          href={`/${s.slug}`}
          aria-current={s.slug === current ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
            s.slug === current ? "border-brand bg-brand/[0.07] text-brand" : "border-line bg-white text-fog hover:text-snow"
          }`}
        >
          {s.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Every item as a plain link, closed until tapped. Shop grids are drawn in the
 * browser, and AI crawlers don't run scripts, so this is how they (and Google)
 * reach each product from the page.
 */
export function ProductLinks({ heading, products }: { heading: string; products: Product[] }) {
  if (!products.length) return null;
  return (
    <details className="mt-10 max-w-5xl rounded-2xl border border-line bg-ink2/80 px-4 py-3">
      <summary className="cursor-pointer font-display text-lg font-bold">{heading}</summary>
      <ul className="mt-3 columns-1 gap-6 text-sm sm:columns-2 lg:columns-3">
        {products.map((p) => (
          <li key={p.id} className="break-inside-avoid py-1">
            <Link href={`/sticker/${p.slug}`} className="text-fog hover:text-snow">
              {seoName(p)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Home page: an H1 + short shop intro, then common questions. */
export function StoreAbout({ faq }: { faq: Faq[] }) {
  return (
    <section className="mx-auto mt-16 w-full max-w-5xl px-4 pb-8 sm:px-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        Stickers and wall posters, made for India
      </h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-fog">
        StickyPie is an online sticker shop for{" "}
        <Link
          href="/car-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          car stickers
        </Link>
        ,{" "}
        <Link
          href="/bike-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          bike stickers
        </Link>
        ,{" "}
        <Link
          href="/laptop-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          laptop stickers
        </Link>
        ,{" "}
        <Link
          href="/helmet-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          helmet stickers
        </Link>{" "}
        and{" "}
        <Link
          href="/bottle-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          water bottle stickers
        </Link>
        . Every design is printed to order on die-cut vinyl in a range of
        sizes. Peel,
        stick and make anything yours, with delivery to pin codes across India.
        Want stickers of yourself? Send a selfie for{" "}
        <Link
          href="/avatar-stickers"
          className="text-snow underline-offset-2 hover:underline"
        >
          AI avatar stickers
        </Link>{" "}
        in anime, chibi, 90s retro and more trending styles.
      </p>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-fog">
        Doing up a room? Our{" "}
        <Link
          href="/wall-posters"
          className="text-snow underline-offset-2 hover:underline"
        >
          wall posters
        </Link>{" "}
        are printed on 270 GSM glossy photo paper, one at a time or as ready sets that
        cover a whole wall, with glue dots or double-sided tape included.
      </p>
      <PosterTopics className="mt-4" />

      <h2 className="mt-10 font-display text-xl font-bold">
        Questions, answered
      </h2>
      <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
        {faq.map(({ q, a }) => (
          <FaqItem key={q} q={q} a={a} />
        ))}
      </div>
    </section>
  );
}
