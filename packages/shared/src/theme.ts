/**
 * The shop's theme colours — change them here to re-colour the storefront:
 * buttons, links, badges, focus rings, the payment pop-up, share images and
 * emails all read from this. (Sticker art colours are separate.)
 */
export const SHOP_THEME = {
  /** Main colour: buttons, links, badges, highlights. */
  brand: "#ea580c",
  /** Second colour of the brand gradient (buttons, the "AI" word, email bar). */
  brand2: "#f08a55",
  /** Pale tint behind pictures (avatar cards, custom cards). */
  brandSoft: "#fef3ee",
} as const;

/** The theme as CSS variables, for the storefront's <head>. */
export function shopThemeCss(): string {
  return `:root{--theme-brand:${SHOP_THEME.brand};--theme-brand2:${SHOP_THEME.brand2};--theme-brand-soft:${SHOP_THEME.brandSoft}}`;
}
