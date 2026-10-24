// Server-rendered text blocks that give each page real, readable content for
// shoppers and search engines (details, how-to, FAQ). No client JS.
import FaqItem from "@/components/faq-item";
import Link from "@/components/page-link";
import type { Faq } from "@/lib/seo";

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

/** Home page: an H1 + short shop intro, then common questions. */
export function StoreAbout({ faq }: { faq: Faq[] }) {
  return (
    <section className="mx-auto mt-16 w-full max-w-5xl px-4 pb-8 sm:px-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        Waterproof vinyl stickers, made for India
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
        . Every design is printed to order on premium die-cut vinyl —
        waterproof, scratch-resistant and UV-safe — in a range of sizes. Peel,
        stick and make anything yours, with delivery to pin codes across India.
      </p>

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
