// /llms.txt — a plain-text guide to the shop for AI assistants and AI search
// (ChatGPT, Gemini / Google AI, Perplexity, Claude…): what StickyPie is, how
// ordering and shipping work, and every wall poster and sticker on sale with
// its price per size and link. Built once at deploy and served as a free static file (AI
// crawlers fetch it often); new stickers appear with the next deploy.
import { POSTER_ADHESIVE, POSTER_PAPER, PUZZLE_POSTER_PRICES, categoryPath, formatINR, inCategory } from "@stickypie/shared";
import { isMiniPoster, isPoster, isPosterPack, sizeChipLabel } from "@/lib/poster";
import { getDriver } from "@/lib/data";
import { POSTER_SURFACES, SURFACES, allLandings, stickersForSurface } from "@/lib/surfaces";
import { SITE_NAME, absoluteUrl, isProductionSite } from "@/lib/site";
import { avatarFaq, customFaq, seoName, storeFaq, wallPosterFaq } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";

export const dynamic = "force-static";

export async function GET() {
  if (!isProductionSite()) {
    return new Response(`# ${SITE_NAME} (test site)\n\nThe real shop is https://stickypie.in\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const driver = getDriver();
  const [products, categories, festivals] = await Promise.all([
    driver.listProducts({ activeOnly: true }),
    driver.listCategories(),
    driver.getFestivals(),
  ]);
  const festivalPages = allLandings(festivals, categories).filter((s) => s.when);
  const facts = await loadShopFacts();
  const puzzlePercent = await driver.getPuzzlePercent();
  // store questions first, then the make-your-own ones not already asked
  const faq = storeFaq(facts);
  for (const item of [...wallPosterFaq(facts), ...avatarFaq(facts), ...customFaq(facts)]) if (!faq.some((f) => f.q === item.q)) faq.push(item);
  const prices = products.flatMap((p) => (p.sizes.length ? p.sizes.map((s) => s.price) : [p.price]));
  const from = prices.length ? formatINR(Math.min(...prices)) : null;

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (stickypie.in) is an online sticker and wall poster shop in India. It sells wall posters (${facts.wallSets} ready wall poster sets and ${facts.posters} single mini posters on premium poster paper) and die-cut vinyl stickers and decals for cars, bikes, laptops, helmets and water bottles — ${facts.designs} designs${from ? ` from ${from}` : ""} — plus ${facts.avatar ? "AI avatar stickers made from your selfie, " : ""}custom stickers printed from your own design, QR code stickers and name stickers. Ships across India.`,
    "",
    `Not to be confused with "StickyPie", a gaze-based marking menu from AR/VR research: ${SITE_NAME} at stickypie.in is a sticker and wall poster shop.`,
    "",
    ...(facts.wallSets || facts.posters
      ? [
          "## Wall posters",
          `- Page: ${absoluteUrl("/wall-posters")}`,
          `- What: wall posters printed to order on ${POSTER_PAPER}, with ${POSTER_ADHESIVE} included, in 4 × 6 in and 6 × 9 in.`,
          `- Ready wall poster sets: ${facts.wallSets}${facts.wallSetFrom !== null ? `, from ${formatINR(facts.wallSetFrom)} for the whole set` : ""}. Any poster in a set can be swapped for another at the same price.`,
          `- Single mini posters: ${facts.posters}${facts.posterFrom !== null ? `, from ${formatINR(facts.posterFrom)}` : ""}, each as a wall poster or a puzzle poster.`,
          `- [Puzzle posters](${absoluteUrl("/puzzle-posters")}): any mini poster printed as 9 cards that join into one big poster, 12 × 18 in for ${formatINR(PUZZLE_POSTER_PRICES[6])} or 18 × 27 in for ${formatINR(PUZZLE_POSTER_PRICES[9])}. Each poster has a free online 9-tile puzzle; solving it gives ${puzzlePercent}% off the puzzle posters in one order (puzzle posters only) for 24 hours.`,
          ...POSTER_SURFACES.slice(1).filter((s) => !s.puzzle).flatMap((s) => {
            const count = stickersForSurface(s, products, categories).matched.length;
            return count ? [`- [${s.name}](${absoluteUrl(`/${s.slug}`)}): ${count} wall posters and sets`] : [];
          }),
          "",
        ]
      : []),
    ...(facts.avatar
      ? [
          "## AI avatar stickers (stickers of you from your photo)",
          `- Page: ${absoluteUrl("/avatar-stickers")}`,
          `- What: a cartoon version of you, made by an AI model from your selfie, printed as die-cut vinyl stickers.`,
          `- Styles (${facts.avatar.styles.length}): ${facts.avatar.styles.join(", ")}. One sticker pack per style.`,
          `- Price: ${formatINR(facts.avatar.price)} per pack, minimum ${facts.avatar.packs} packs (${formatINR(facts.avatar.packs * facts.avatar.price)})${
            facts.avatar.extra !== facts.avatar.price ? `, then ${formatINR(facts.avatar.extra)} for each extra pack` : ""
          }; no minimum order value.`,
          "- How: pick styles → add one clear photo of your face → pay → we make the AI stickers and show them on your order page → printed and shipped across India.",
          "",
        ]
      : []),
    "## Ordering & delivery",
    "- Prices are in Indian rupees (INR), per sticker, by size (size = the longest side in inches).",
    "- Dispatched in 2–4 days, delivered in 3–5 days anywhere in India. Delivery within India only.",
    "- All orders are prepaid online: UPI, debit/credit cards, net banking or wallets. No cash on delivery.",
    "- Everything is printed to order, so orders can't be cancelled after payment; damaged or wrong items are replaced free, shipping included.",
    "- AI avatar stickers (from your selfie), custom stickers (your own logo/photo), QR code stickers and name stickers are made to order.",
    "",
    "## Questions & answers",
    ...faq.flatMap(({ q, a }) => [`### ${q}`, a, ""]),
    "## Main pages",
    `- [Wall posters](${absoluteUrl("/wall-posters")})`,
    `- [Wall poster sets](${absoluteUrl(categoryPath("poster-packs"))})`,
    `- [All stickers](${absoluteUrl("/stickers")})`,
    ...SURFACES.map((s) => `- [${s.name}](${absoluteUrl(`/${s.slug}`)})`),
    ...festivalPages.map((s) => `- [${s.name}](${absoluteUrl(`/${s.slug}`)}): festival stickers and mini posters for ${s.when}`),
    ...(facts.avatar
      ? [`- [AI avatar stickers](${absoluteUrl("/avatar-stickers")}): stickers of you from your photo in ${facts.avatar.styles.length} AI styles (${facts.avatar.styles.slice(0, 5).join(", ")}…), ${formatINR(facts.avatar.price)} a pack`]
      : []),
    `- [Custom stickers](${absoluteUrl("/custom-stickers")}): print your own design, QR code or name`,
    `- [QR code stickers](${absoluteUrl("/qr-code-stickers")})`,
    `- [Name & text stickers](${absoluteUrl("/name-stickers")})`,
    ...(facts.posters ? [`- [Mini posters](${absoluteUrl(categoryPath("mini-posters"))}): ${facts.posters} mini posters, each as a wall poster on ${POSTER_PAPER} (${POSTER_ADHESIVE} included) or as a 9-card puzzle poster`] : []),
    `- [Contact](${absoluteUrl("/contact")})`,
    `- [Shipping policy](${absoluteUrl("/legal/shipping")}) · [Refunds & cancellations](${absoluteUrl("/legal/refunds")})`,
    "",
    "## Categories",
    ...categories
      .filter((c) => products.some((p) => inCategory(p, c.id)))
      .map((c) => `- [${c.name} stickers](${absoluteUrl(categoryPath(c.slug))})`),
    "",
  ];
  const listing = (p: (typeof products)[number]) => {
    const sizes = [...p.sizes].sort((a, b) => a.inches - b.inches);
    const price = sizes.length
      ? sizes.map((s) => `${isPoster(p) ? `${sizeChipLabel(p, s.inches)} in` : `${s.inches}″`} ${formatINR(s.price)}`).join(", ")
      : formatINR(p.price);
    const stock = p.stock === 0 ? " (out of stock)" : "";
    return `- [${seoName(p)}](${absoluteUrl(`/sticker/${p.slug}`)}): ${price}${stock}${p.description ? ` — ${p.description.trim()}` : ""}`;
  };
  // Mini posters can be stickers too, so each one is listed once, under posters.
  const sets = products.filter(isPosterPack);
  const posters = products.filter((p) => isMiniPoster(p) && !isPosterPack(p));
  const stickers = products.filter((p) => !isPoster(p));
  for (const [title, list] of [
    ["Wall poster sets and prices", sets],
    ["Mini posters and prices", posters],
    ["Stickers and prices", stickers],
  ] as const) {
    if (list.length) lines.push(`## ${title}`, ...list.map(listing), "");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
