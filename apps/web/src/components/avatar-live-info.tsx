"use client";

import { avatarBook, avatarExtraPrice, formatINR } from "@stickypie/shared";
import FaqItem from "@/components/faq-item";
import { useFeatures, useStoreSettings } from "@/lib/live-catalog";
import { avatarFaq, type ShopFacts } from "@/lib/seo";

type AvatarFacts = NonNullable<ShopFacts["avatar"]>;

/**
 * The avatar page's styles list and FAQ. The page itself is a static file
 * (opens instantly); these start from the facts baked in at deploy time (so
 * search engines read them in the HTML) and switch to the live admin settings
 * as soon as they load, so admin edits show without a deploy.
 */
export default function AvatarLiveInfo({ initial }: { initial: AvatarFacts | null }) {
  const settings = useStoreSettings();
  const features = useFeatures();
  const book = settings.loaded && features.avatarStickers ? avatarBook(settings) : null;
  const avatar: AvatarFacts | null = !settings.loaded
    ? initial
    : book
      ? {
          packs: book.pages,
          price: book.price,
          extra: avatarExtraPrice(book),
          styles: settings.avatarStyles.map((s) => s.label),
          pictures: initial?.pictures ?? [],
        }
      : null;
  if (!avatar) return null;
  // Only the avatar part of the facts is read by avatarFaq.
  const faq = avatarFaq({ avatar } as ShopFacts);

  return (
    <>
      {/* Every style in words, for shoppers scrolling past and for search / AI answers. */}
      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">AI sticker styles of you</h2>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          Send one selfie and get a cartoon version of you, made with AI, in any of {avatar.styles.length} trending
          styles. Each style is a pack of stickers of you, printed on die-cut vinyl for laptops, phones, bottles, cars
          and bikes, and shipped across India. {formatINR(avatar.price)} a pack, {avatar.packs} packs or more
          {avatar.extra !== avatar.price && <>, then {formatINR(avatar.extra)} for each extra pack</>}.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {avatar.styles.map((st) => (
            <li key={st} className="rounded-full border border-line bg-ink2/80 px-3 py-1.5 text-xs font-semibold text-snow">
              {st} stickers of you
            </li>
          ))}
        </ul>
      </section>
      {faq.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-bold">AI avatar stickers, answered</h2>
          <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-ink2/80">
            {faq.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
