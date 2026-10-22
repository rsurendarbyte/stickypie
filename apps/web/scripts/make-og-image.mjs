// Builds public/og-image.png — the link preview card (WhatsApp, Instagram,
// X, Google) for the home and listing pages. Sticker pages use their own art.
// Re-run after changing the logo:  node scripts/make-og-image.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 630;
const FONT = "Arial Rounded MT Bold, Arial Rounded MT, Helvetica Neue, Arial, sans-serif";

const dots = Array.from({ length: 30 * 16 }, (_, i) => {
  const x = (i % 30) * 42 + 21;
  const y = Math.floor(i / 30) * 42 + 21;
  return `<circle cx="${x}" cy="${y}" r="2.2" fill="#f2d6c4"/>`;
}).join("");

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff8f1"/>
      <stop offset="1" stop-color="#ffe9df"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff2e63"/>
      <stop offset="1" stop-color="#ff7a3c"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${dots}
  <!-- logo backing: white die-cut sticker -->
  <rect x="96" y="135" width="360" height="360" rx="72" fill="#ffffff" transform="rotate(-6 276 315)"
        style="filter: drop-shadow(0 18px 30px rgba(16,24,40,0.18))"/>
  <text x="520" y="285" font-family="${FONT}" font-size="104" font-weight="800" fill="#15161e">Sticky<tspan fill="#f9530a">Pie</tspan></text>
  <text x="524" y="352" font-family="${FONT}" font-size="44" font-weight="700" fill="url(#brand)">Stick Your Style</text>
  <text x="524" y="420" font-family="${FONT}" font-size="30" fill="#5b6478">Waterproof die-cut vinyl stickers</text>
  <text x="524" y="462" font-family="${FONT}" font-size="30" fill="#5b6478">Car · Bike · Laptop · Custom designs</text>
  <rect x="524" y="500" width="250" height="56" rx="28" fill="url(#brand)"/>
  <text x="649" y="537" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="#ffffff">stickypie.in</text>
</svg>`;

const logo = await sharp(path.join(appDir, "public/icons/icon-512.png"))
  .resize(300, 300)
  .rotate(-6, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const logoMeta = await sharp(logo).metadata();

await sharp(Buffer.from(svg))
  .composite([{ input: logo, left: Math.round(276 - logoMeta.width / 2), top: Math.round(315 - logoMeta.height / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(appDir, "public/og-image.png"));

console.log("✔ public/og-image.png");
