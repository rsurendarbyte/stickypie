// /llms.txt — a plain-text guide to the shop for AI assistants and AI search
// (ChatGPT, Gemini / Google AI, Perplexity, Claude…): what StickyPie is, how
// ordering and shipping work, and every sticker on sale with its price per
// size and link. Built once at deploy and served as a free static file (AI
// crawlers fetch it often); new stickers appear with the next deploy.
import { categoryPath, formatINR, inCategory } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { SURFACES } from "@/lib/surfaces";
import { SITE_NAME, absoluteUrl, isProductionSite } from "@/lib/site";
import { customFaq, seoName, storeFaq } from "@/lib/seo";
import { loadShopFacts } from "@/lib/shop-facts";

export const dynamic = "force-static";

export async function GET() {
  if (!isProductionSite()) {
    return new Response(`# ${SITE_NAME} (test site)\n\nThe real shop is https://stickypie.in\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const driver = getDriver();
  const [products, categories] = await Promise.all([
    driver.listProducts({ activeOnly: true }),
    driver.listCategories(),
  ]);
  const facts = await loadShopFacts();
  // store questions first, then the make-your-own ones not already asked
  const faq = storeFaq(facts);
  for (const item of customFaq(facts)) if (!faq.some((f) => f.q === item.q)) faq.push(item);
  const prices = products.flatMap((p) => (p.sizes.length ? p.sizes.map((s) => s.price) : [p.price]));
  const from = prices.length ? formatINR(Math.min(...prices)) : null;

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (stickypie.in) is an online sticker shop in India. It sells waterproof, UV-safe die-cut vinyl stickers and decals for cars, bikes, laptops, helmets and water bottles — ${products.length} designs${from ? ` from ${from}` : ""} — plus custom stickers printed from your own design, QR code stickers and name stickers. Ships across India.`,
    "",
    "## Ordering & delivery",
    "- Prices are in Indian rupees (INR), per sticker, by size (size = the longest side in inches).",
    "- Dispatched in 2–4 days, delivered in 3–5 days anywhere in India. Delivery within India only.",
    "- All orders are prepaid online: UPI, debit/credit cards, net banking or wallets. No cash on delivery.",
    "- Everything is printed to order, so orders can't be cancelled after payment; damaged or wrong items are replaced free, shipping included.",
    "- Custom stickers (your own logo/photo), QR code stickers and name stickers are made to order.",
    "",
    "## Questions & answers",
    ...faq.flatMap(({ q, a }) => [`### ${q}`, a, ""]),
    "## Main pages",
    `- [All stickers](${absoluteUrl("/stickers")})`,
    ...SURFACES.map((s) => `- [${s.name}](${absoluteUrl(`/${s.slug}`)})`),
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
