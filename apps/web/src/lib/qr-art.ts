// Browser-only: draws a QR code sticker (white rounded sticker, QR, optional
// label) onto a canvas. Used for the QR sticker maker and the hero slide.
import QRCode from "qrcode";

/**
 * Draws the print file: a white rounded sticker with the QR and an optional
 * label under it. 1200 px wide — sharp at every size we print.
 */
export function drawSticker(value: string, label: string, width = 1200): HTMLCanvasElement {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const pad = Math.round(width * 0.09);
  const qrSize = width - pad * 2;
  const labelH = label ? Math.round(width * 0.2) : 0;
  const height = width + labelH - (label ? Math.round(pad * 0.4) : 0);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  // sticker body
  const r = Math.round(width * 0.1);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, r);
  ctx.fill();
  // QR modules
  const cell = qrSize / n;
  ctx.fillStyle = "#111318";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) ctx.fillRect(pad + x * cell, pad + y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  if (label) {
    const font = getComputedStyle(document.documentElement).getPropertyValue("--font-fredoka").trim() || "sans-serif";
    let size = Math.round(width * 0.105);
    ctx.font = `700 ${size}px ${font}`;
    while (ctx.measureText(label).width > width - pad * 2 && size > 30) {
      size -= 4;
      ctx.font = `700 ${size}px ${font}`;
    }
    ctx.fillStyle = "#111318";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width / 2, pad + qrSize + labelH / 2 - pad * 0.15);
  }
  return c;
}

