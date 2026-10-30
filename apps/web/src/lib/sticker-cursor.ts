// The mouse pointer as a die-cut sticker: the usual dark arrow (so it's never
// hard to find) with a white sticker edge, a soft shadow and a little "SP" tag
// beside it in the shop's theme colour. Over links and buttons the arrow turns
// the theme colour too — the "you can click this" cue. It's a real system
// cursor (CSS), so it moves exactly with the mouse — nothing is drawn or
// animated in JavaScript. Mouse users only; touch screens never show a cursor.
// Text fields keep the text cursor, and anything with its own cursor (grab,
// zoom…) keeps it.
import { SHOP_THEME } from "@stickypie/shared";

// lucide "mouse-pointer-2": the tip sits at (4, 4.7) of a 24-unit box
const ARROW =
  "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z";
const INK = "#1c1a24";
// 33×24 drawing units (arrow + tag) shown at 44×32 px
const WIDTH = 44;
const HEIGHT = 32;
const HOTSPOT = "4 5"; // the arrow's tip, in px

function cursor(arrowFill: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${WIDTH}' height='${HEIGHT}' viewBox='0 0 33 24'>` +
    // soft shadow, then the white die-cut edge, then the arrow itself
    `<path d='${ARROW}' transform='translate(.7 1)' fill='rgba(16,24,40,.25)' stroke='rgba(16,24,40,.25)' stroke-width='3.4' stroke-linejoin='round'/>` +
    `<path d='${ARROW}' fill='#fff' stroke='#fff' stroke-width='3.4' stroke-linejoin='round'/>` +
    `<path d='${ARROW}' fill='${arrowFill}' stroke='${INK}' stroke-width='1.1' stroke-linejoin='round'/>` +
    // the "SP" sticker tag
    `<rect x='17' y='15.5' width='14.5' height='7.5' rx='3.75' fill='${SHOP_THEME.brand}' stroke='#fff' stroke-width='1.2'/>` +
    `<text x='24.25' y='21.1' font-family='Arial,Helvetica,sans-serif' font-weight='700' font-size='5.4' fill='#fff' text-anchor='middle'>SP</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${HOTSPOT}`;
}

/** The sticker cursor as CSS, in the theme colour (SHOP_THEME), for the <head>. */
export function stickerCursorCss(): string {
  const normal = cursor(INK);
  const hot = cursor(SHOP_THEME.brand);
  return (
    "@media (hover:hover) and (pointer:fine){" +
    `html{cursor:${normal},auto}` +
    `html a[href],html button:not(:disabled),html [role="button"]:not([aria-disabled="true"]),html summary,html select,html label[for],html input[type="checkbox"],html input[type="radio"]{cursor:${hot},pointer}` +
    // the arrow is inherited, so text fields ask for the text cursor back
    'html input:not([type="checkbox"],[type="radio"],[type="range"],[type="button"],[type="submit"],[type="color"],[type="file"]),html textarea,html [contenteditable="true"]{cursor:text}' +
    "}"
  );
}
