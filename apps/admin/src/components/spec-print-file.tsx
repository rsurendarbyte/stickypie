"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { TEXT_STICKER_FONTS, type CustomSpec } from "@stickypie/shared";
import { drawSticker } from "@stickypie/shared/qr-art";
import { drawTextSticker, loadStickerFont } from "@stickypie/shared/text-art";
import { STICKER_FONT_FAMILY } from "@/lib/sticker-fonts";

/** Print files are drawn this big (longest side, px) — sharp up to large sizes. */
const PRINT_PX = 3000;

async function draw(spec: CustomSpec, size: number): Promise<HTMLCanvasElement> {
  if (spec.kind === "qr") return drawSticker(spec.value, spec.label, size);
  const font = TEXT_STICKER_FONTS.find((f) => f.id === spec.font) ?? TEXT_STICKER_FONTS[0];
  const family = STICKER_FONT_FAMILY[font.id];
  await loadStickerFont(family, font.weight);
  return drawTextSticker(
    { line1: spec.line1, line2: spec.line2, family, weight: font.weight, color: spec.color, color2: spec.color2, style: spec.style },
    size
  );
}

/**
 * A QR or name sticker on an order: nothing was uploaded — the order keeps
 * what to draw, and this draws the preview and the full-size print PNG.
 */
export function SpecThumb({ spec }: { spec: CustomSpec }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void draw(spec, 160).then((c) => live && setSrc(c.toDataURL("image/png")));
    return () => {
      live = false;
    };
  }, [spec]);
  return src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" /> : null;
}

export function SpecDetails({ spec }: { spec: CustomSpec }) {
  if (spec.kind === "qr") {
    return (
      <span className="block text-xs text-fog">
        QR opens <span className="font-mono break-all text-snow">{spec.value}</span>
        {spec.label ? <> · label “{spec.label}”</> : " · no label"}
      </span>
    );
  }
  const font = TEXT_STICKER_FONTS.find((f) => f.id === spec.font)?.label ?? spec.font;
  return (
    <span className="block text-xs text-fog">
      “<span className="text-snow">{spec.line1}</span>”{spec.line2 ? <> / “{spec.line2}”</> : null} · {font} ·{" "}
      <span className="inline-block size-2.5 rounded-full align-middle ring-1 ring-white/30" style={{ background: spec.color }} />{" "}
      {spec.style === "label" ? "label" : "cut-out letters"}
    </span>
  );
}

export function SpecDownload({ spec, fileName }: { spec: CustomSpec; fileName: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const canvas = await draw(spec, PRINT_PX);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title={`Download the print file (${PRINT_PX}px PNG)`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-snow transition-colors hover:bg-white/5 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Print PNG
    </button>
  );
}
