// /llms.txt — a plain-text guide to the shop for AI assistants and AI search
// (ChatGPT, Gemini / Google AI, Perplexity, Claude…): what StickyPie is, how
// ordering and shipping work, and every sticker on sale with its price per
// size and link. Built once at deploy and served as a free static file (AI
// crawlers fetch it often); new stickers appear with the next deploy.
import { categoryPath, formatINR, inCategory } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { SURFACES, allLandings } from "@/lib/surfaces";
import { SITE_NAME, absoluteUrl, isProductionSite } from "@/lib/site";
import { avatarFaq, customFaq, seoName, storeFaq } from "@/lib/seo";
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
  const festivalPages = allLandings(festivals, categories).slice(SURFACES.length);
  const facts = await loadShopFacts();
  // store questions first, then the make-your-own ones not already asked
  const faq = storeFaq(facts);
  for (const item of [...avatarFaq(facts), ...customFaq(facts)]) if (!faq.some((f) => f.q === item.q)) faq.push(item);
  const prices = products.flatMap((p) => (p.sizes.length ? p.sizes.map((s) => s.price) : [p.price]));
  const from = prices.length ? formatINR(Math.min(...prices)) : null;

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (stickypie.in) is an online sticker shop in India. It sells die-cut vinyl stickers and decals for cars, bikes, laptops, helmets and water bottles — ${products.length} designs${from ? ` from ${from}` : ""} — plus ${facts.avatar ? "AI avatar stickers made from your selfie, " : ""}custom stickers printed from your own design, QR code stickers and name stickers. Ships across India.`,
    "",
    `Not to be confused with "StickyPie", a gaze-based marking menu from AR/VR research: ${SITE_NAME} at stickypie.in is a sticker shop.`,
    "",
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
    `- [All stickers](${absoluteUrl("/stickers")})`,
    ...SURFACES.map((s) => `- [${s.name}](${absoluteUrl(`/${s.slug}`)})`),
    ...festivalPages.map((s) => `- [${s.name}](${absoluteUrl(`/${s.slug}`)}): festival stickers and mini posters for ${s.when}`),
    ...(facts.avatar
      ? [`- [AI avatar stickers](${absoluteUrl("/avatar-stickers")}): stickers of you from your photo in ${facts.avatar.styles.length} AI styles (${facts.avatar.styles.slice(0, 5).join(", ")}…), ${formatINR(facts.avatar.price)} a pack`]
      : []),
    `- [Custom stickers](${absoluteUrl("/custom-stickers")}): print your own design, QR code or name`,
    `- [QR code stickers](${absoluteUrl("/qr-code-stickers")})`,
    `- [Name & text stickers](${absoluteUrl("/name-stickers")})`,
    ...(facts.posters ? [`- [Mini posters](${absoluteUrl(categoryPath("mini-posters"))}): ${facts.posters} car, bike and art mini posters`] : []),
    `- [Contact](${absoluteUrl("/contact")})`,
    `- [Shipping policy](${absoluteUrl("/legal/shipping")}) · [Refunds & cancellations](${absoluteUrl("/legal/refunds")})`,
    "",
    "## Categories",
    ...categories
      .filter((c) => products.some((p) => inCategory(p, c.id)))
      .map((c) => `- [${c.name} stickers](${absoluteUrl(categoryPath(c.slug))})`),
    "",
    "## Stickers and prices",
  ];
  for (const p of products) {
    const sizes = [...p.sizes].sort((a, b) => a.inches - b.inches);
    const price = sizes.length
      ? sizes.map((s) => `${s.inches}″ ${formatINR(s.price)}`).join(", ")
      : formatINR(p.price);
    const stock = p.stock === 0 ? " (out of stock)" : "";
    lines.push(`- [${seoName(p)}](${absoluteUrl(`/sticker/${p.slug}`)}): ${price}${stock}${p.description ? ` — ${p.description.trim()}` : ""}`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
