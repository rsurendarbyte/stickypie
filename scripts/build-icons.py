"""Builds every favicon / app icon / logo size from brand/stickypie-logo.png.

    npm run icons:build

Writes into apps/web/public (shop) and apps/admin/public (admin). Replace the
source logo and re-run to update the brand mark everywhere at once.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "stickypie-logo.png"
TARGETS = [ROOT / "apps" / "web" / "public", ROOT / "apps" / "admin" / "public"]


def square_logo(src: Image.Image, padding: float = 0.04) -> Image.Image:
    """Crop to the visible logo and centre it on a transparent square."""
    rgba = src.convert("RGBA")
    bbox = rgba.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    logo = rgba.crop(bbox)
    side = int(max(logo.size) * (1 + 2 * padding))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(logo, ((side - logo.width) // 2, (side - logo.height) // 2), logo)
    return canvas


def resized(img: Image.Image, size: int) -> Image.Image:
    # Resample premultiplied so hidden colour under transparent pixels
    # can't bleed into the edges as a dark fringe.
    return img.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")


def on_white(img: Image.Image) -> Image.Image:
    # iOS shows transparent home-screen icon areas as black.
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    bg.alpha_composite(img)
    return bg.convert("RGB")


def main() -> None:
    logo = square_logo(Image.open(SOURCE))
    for public in TARGETS:
        icons = public / "icons"
        icons.mkdir(parents=True, exist_ok=True)
        resized(logo, 32).save(icons / "favicon-32.png", optimize=True)
        resized(logo, 192).save(icons / "icon-192.png", optimize=True)
        resized(logo, 512).save(icons / "icon-512.png", optimize=True)
        on_white(resized(logo, 180)).save(icons / "apple-touch-icon.png", optimize=True)
        resized(logo, 256).save(public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
        print(f"✔ icons written to {public.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
