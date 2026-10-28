// Server-only: the live numbers that FAQ answers and /llms.txt quote (design
// count, starting prices, make-your-own prices), read at build time.
import { avatarBook, avatarExtraPrice, customSizes } from "@stickypie/shared";
import { getDriver } from "./data";
import { isMiniPoster } from "./poster";
import { absoluteUrl } from "./site";
import type { ShopFacts } from "./seo";

export async function loadShopFacts(): Promise<ShopFacts> {
  const driver = getDriver();
  const [products, settings, features] = await Promise.all([
    driver.listProducts({ activeOnly: true }),
    driver.getSettings(),
    driver.getFeatures(),
  ]);
  // Make-your-own (custom, QR, name) is only offered while its switch is on.
  const made = (prices: Record<string, number>) => (features.customStickers ? customSizes(prices) : []);
  const lowest = (list: typeof products) => {
    const prices = list.flatMap((p) => (p.sizes.length ? p.sizes.map((s) => s.price) : [p.price]));
    return prices.length ? Math.min(...prices) : null;
  };
  const posters = products.filter(isMiniPoster);
  return {
    designs: products.length,
    posters: posters.length,
    stickerFrom: lowest(products),
    posterFrom: lowest(posters),
    custom: made(settings.customPrices),
    qr: made(settings.qrPrices),
    text: made(settings.textPrices),
    avatar: (() => {
      const book = features.avatarStickers ? avatarBook(settings) : null;
      if (!book) return null;
      // one card picture per style (its first), for search results and AI answers
      const pictures = settings.avatarStyles.flatMap((s) => {
        const url = s.covers[0] ?? s.images[0];
        return url ? [{ style: s.label, url: url.startsWith("/") ? absoluteUrl(url) : url }] : [];
      });
      return { packs: book.pages, price: book.price, extra: avatarExtraPrice(book), styles: settings.avatarStyles.map((s) => s.label), pictures };
    })(),
  };
}
