"""
Makes a 9:16 Instagram reel (1080 × 1920, 30 fps, ~12 s, no sound) for a wall
poster pack from the live shop: "Blank wall?" → the posters stick on one by one
in the pack's layout → what's inside → price and stickypie.in.

  python3 scripts/pack-reel/reel.py 4x4-garage-poster-pack [more slugs…]
  python3 scripts/pack-reel/reel.py --all          → every active pack
  add --dev to read the dev database instead of prod

Reels land in prod_stickers/poster-packs/reels/<slug>.mp4 (plus a <slug>-cover.jpg
to use as the reel cover). Add trending audio in Instagram.
"""
import io, json, math, os, re, shutil, subprocess, sys, tempfile, urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
OUT = os.path.join(ROOT, "prod_stickers/poster-packs/reels")
W, H, FPS = 1080, 1920, 30

# Brand look (same as the shop)
BG = (253, 246, 241)
DOT = (246, 212, 220)
INK = (29, 24, 22)
MUTED = (110, 98, 92)
ORANGE = (249, 83, 10)
YELLOW = (255, 200, 52)

def font(name, size):
    return ImageFont.truetype(os.path.join(HERE, "fonts", name), size)

def rounded_font(size, weight=800):
    """SF Rounded (macOS): has the ₹ sign, which the web font subsets lack."""
    f = ImageFont.truetype("/System/Library/Fonts/SFNSRounded.ttf", size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f

DISPLAY = lambda s: font("LuckiestGuy.woff2", s)
HEAD = lambda s: font("Fredoka.woff2", s)

# Same collage layouts as scripts/create-poster-packs.mjs (a 3 × 4.5 board).
def grid(cols):
    return [[(i % cols) * (3 / cols), (i // cols) * (4.5 / cols), 3 / cols, 4.5 / cols] for i in range(cols * cols)]

LAYOUTS = {
    4: grid(2),
    9: grid(3),
    6: [[0, 0, 2, 3], [2, 0, 1, 1.5], [2, 1.5, 1, 1.5], [0, 3, 1, 1.5], [1, 3, 1, 1.5], [2, 3, 1, 1.5]],
    20: [[0, 0, 1.5, 2.25]]
    + [[1.5 + (i % 3) * 0.5, (i // 3) * 0.75, 0.5, 0.75] for i in range(9)]
    + [[(i % 3) * 0.5, 2.25 + (i // 3) * 0.75, 0.5, 0.75] for i in range(9)]
    + [[1.5, 2.25, 1.5, 2.25]],
}

# ---------- data ----------
def env():
    path = os.path.join(ROOT, "apps/web/.env.local" if "--dev" in sys.argv else "apps/web/.env.prod")
    vals = {}
    for line in open(path):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            vals[m[1]] = m[2].strip().strip('"')
    return vals["NEXT_PUBLIC_SUPABASE_URL"], vals["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

URL, KEY = env()

def get(url, raw=False):
    headers = {"User-Agent": "curl/8.0"}
    if url.startswith(URL):
        headers.update({"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as r:
        data = r.read()
    return data if raw else json.loads(data)

def load_pack(slug):
    [p] = get(f"{URL}/rest/v1/products?slug=eq.{slug}&select=slug,name,price,compare_at_price,pack_items,pack_sizes")
    rows = get(f"{URL}/rest/v1/products?id=in.({','.join(p['pack_items'])})&select=id,name,display_url,image_url")
    by_id = {r["id"]: r for r in rows}
    posters = []
    for pid in p["pack_items"]:
        r = by_id[pid]
        img = Image.open(io.BytesIO(get(r["display_url"] or r["image_url"], raw=True))).convert("RGBA")
        posters.append(img)
    title = re.sub(r"\s+[—-]\s+\d+\s+Mini Poster Pack$", "", p["name"])
    sizes = [(p["pack_sizes"] or [])[i] if i < len(p["pack_sizes"] or []) else 6 for i in range(len(posters))]
    return dict(slug=slug, title=title, price=p["price"], compare=p["compare_at_price"], posters=posters, sizes=sizes)

# ---------- drawing helpers ----------
def ease_out_back(t, s=1.6):
    t -= 1
    return t * t * ((s + 1) * t + s) + 1

def ease_out(t):
    return 1 - (1 - t) ** 3

def ease_in_out(t):
    return 3 * t * t - 2 * t * t * t

def clamp(t):
    return max(0.0, min(1.0, t))

def background():
    bg = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(bg)
    for y in range(18, H, 36):
        for x in range(18, W, 36):
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=DOT)
    return bg

def round_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    return m

def poster_tile(img, w, h):
    """The poster cut to its tile (2:3, cover) with rounded corners and a soft shadow, as RGBA with padding."""
    # cover-crop when the source isn't exactly 2:3
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    tile = img.resize((max(w, round(sw * scale)), max(h, round(sh * scale))), Image.LANCZOS)
    left, top = (tile.width - w) // 2, (tile.height - h) // 2
    tile = tile.crop((left, top, left + w, top + h))
    r = max(6, round(w * 0.035))
    tile.putalpha(round_mask(w, h, r))
    pad = 40
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sm = Image.new("L", out.size, 0)
    ImageDraw.Draw(sm).rounded_rectangle([pad, pad + 10, pad + w, pad + h + 10], r, fill=70)
    shadow.putalpha(sm.filter(ImageFilter.GaussianBlur(14)))
    out.alpha_composite(shadow)
    out.alpha_composite(tile, (pad, pad))
    return out, pad

def text_center(d, cx, y, s, f, fill, anchor="mt"):
    d.text((cx, y), s, font=f, fill=fill, anchor=anchor)

def fit_font(make, s, max_w, start):
    size = start
    while size > 30:
        f = make(size)
        if f.getlength(s) <= max_w:
            return f
        size -= 4
    return make(size)

def pop(frame, layer, cx, cy, t):
    """Paste a text layer centred at (cx, cy) with a bouncy scale-in (t: 0 → 1)."""
    if t <= 0:
        return
    k = max(0.01, ease_out_back(clamp(t)))
    a = clamp(t * 2.5)
    lw, lh = max(1, round(layer.width * k)), max(1, round(layer.height * k))
    l = layer.resize((lw, lh), Image.LANCZOS)
    if a < 1:
        l.putalpha(l.getchannel("A").point(lambda v: round(v * a)))
    frame.alpha_composite(l, (round(cx - lw / 2), round(cy - lh / 2)))

def text_layer(s, f, fill, pad=10, stroke=0, stroke_fill=None):
    box = f.getbbox(s, stroke_width=stroke)
    l = Image.new("RGBA", (box[2] - box[0] + pad * 2, box[3] - box[1] + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(l).text((pad - box[0], pad - box[1]), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return l

def pill(s, f, fill, ink, padx=34, pady=20):
    box = f.getbbox(s)
    tw, th = box[2] - box[0], box[3] - box[1]
    l = Image.new("RGBA", (tw + padx * 2, th + pady * 2 + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(l)
    d.rounded_rectangle([0, 8, l.width - 1, l.height - 1], (th + pady * 2) // 2, fill=(0, 0, 0, 40))
    d.rounded_rectangle([0, 0, l.width - 1, l.height - 9], (th + pady * 2) // 2, fill=fill)
    d.text((padx - box[0], pady - box[1]), s, font=f, fill=ink)
    return l

def size_text(sizes):
    big = sum(1 for s in sizes if s == 9)
    small = len(sizes) - big
    return f"1 big 6 × 9 in + {small} small 4 × 6 in" if big == 1 else (
        f"{big} big 6 × 9 in + {small} small 4 × 6 in" if big else f"each 4 × 6 in")

def inr(n):
    s = str(int(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"₹{s}"

# ---------- the reel ----------
def render(pack, frames_dir):
    n = len(pack["posters"])
    layout = LAYOUTS.get(n) or grid(math.ceil(math.sqrt(n)))
    CW = 700                      # collage width on screen; 2:3 board
    CH = round(CW * 1.5)
    CX, CY = (W - CW) // 2, 370   # collage top-left while building (text stays clear of Instagram's top and caption areas)
    k = CW / 3
    gap = 7

    # each poster's final rect and ready-made tile
    tiles = []
    for i, img in enumerate(pack["posters"]):
        x, y, w, h = layout[i]
        left, top = round(x * k + gap), round(y * k + gap)
        tw, th = round((x + w) * k - gap) - left, round((y + h) * k - gap) - top
        tile, pad = poster_tile(img, tw, th)
        tiles.append(dict(tile=tile, pad=pad, left=left, top=top, w=tw, h=th))

    bg = background()
    # empty slots on the "blank wall"
    slots = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(slots)
    for t in tiles:
        x0, y0 = CX + t["left"], CY + t["top"]
        sd.rounded_rectangle([x0, y0, x0 + t["w"], y0 + t["h"]], max(6, round(t["w"] * 0.035)), outline=(214, 196, 188, 255), width=3)

    hook = text_layer("BLANK WALL?", DISPLAY(118), INK)
    title_font = fit_font(DISPLAY, pack["title"].upper(), W - 120, 110)
    title = text_layer(pack["title"].upper(), title_font, INK)
    kicker = pill("WALL POSTER SET", HEAD(34), ORANGE, (255, 255, 255), padx=26, pady=12)
    count = pill(f"{n} mini posters", HEAD(44), (255, 255, 255), INK)
    sizes = text_layer(size_text(pack["sizes"]), HEAD(40), MUTED)

    # timeline (seconds)
    t_place = 1.0                                   # first poster
    step = min(0.42, 3.4 / n)
    t_built = t_place + step * (n - 1) + 0.5
    t_info = t_built + 0.2
    t_end = t_info + 2.6
    total = t_end + 3.4
    nframes = round(total * FPS)

    price_f = rounded_font(150, 900)
    price = text_layer(inr(pack["price"]), price_f, INK)
    compare = None
    if pack["compare"] and pack["compare"] > pack["price"]:
        c = text_layer(inr(pack["compare"]), rounded_font(64, 600), MUTED)
        d = ImageDraw.Draw(c)
        d.line([8, c.height // 2 + 4, c.width - 8, c.height // 2 + 4], fill=MUTED, width=6)
        compare = c
        save = round((1 - pack["price"] / pack["compare"]) * 100)
        badge = pill(f"SAVE {save}%", HEAD(40), ORANGE, (255, 255, 255), padx=26, pady=12)
    cta = pill("Shop at stickypie.in", HEAD(56), YELLOW, INK, padx=48, pady=26)
    logo = Image.open(os.path.join(ROOT, "apps/web/public/icons/icon-192.png")).convert("RGBA").resize((96, 96), Image.LANCZOS)
    brand = text_layer("StickyPie", HEAD(56), ORANGE)

    for fi in range(nframes):
        t = fi / FPS
        frame = bg.copy().convert("RGBA")

        # collage transform: build at full size → gentle push-in → shrink up for the end card
        if t < t_end:
            zoom = 1 + 0.05 * ease_in_out(clamp((t - t_info) / (t_end - t_info))) if t > t_info else 1
            sx, ox, oy = zoom, CX - CW * (zoom - 1) / 2, CY - CH * (zoom - 1) / 2
        else:
            e = ease_in_out(clamp((t - t_end) / 0.7))
            z0, z1 = 1.05, 0.62
            sx = z0 + (z1 - z0) * e
            ox0, oy0 = CX - CW * (z0 - 1) / 2, CY - CH * (z0 - 1) / 2
            ox1, oy1 = (W - CW * z1) / 2, 250
            ox, oy = ox0 + (ox1 - ox0) * e, oy0 + (oy1 - oy0) * e

        # empty slots fade out as the wall fills
        if t < t_built + 0.4:
            a = 1 - clamp((t - t_place) / (t_built - t_place + 0.4))
            if a > 0:
                s = slots.copy()
                s.putalpha(s.getchannel("A").point(lambda v: round(v * a)))
                frame.alpha_composite(s)

        layer = Image.new("RGBA", (CW + 200, CH + 200), (0, 0, 0, 0))
        for i, tl in enumerate(tiles):
            p = (t - (t_place + i * step)) / 0.45
            if p <= 0:
                continue
            p = clamp(p)
            e = ease_out_back(p, 1.3)
            scale = 1.35 - 0.35 * e
            rot = (8 if i % 2 else -8) * (1 - ease_out(p))
            dy = -70 * (1 - ease_out(p))
            img = tl["tile"]
            if scale != 1 or rot:
                img = img.resize((round(img.width * scale), round(img.height * scale)), Image.BILINEAR)
                if rot:
                    img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
            if p < 1:
                img.putalpha(img.getchannel("A").point(lambda v: round(v * clamp(p * 3))))
            cx = 100 + tl["left"] + tl["w"] / 2
            cy = 100 + tl["top"] + tl["h"] / 2 + dy
            layer.alpha_composite(img, (round(cx - img.width / 2), round(cy - img.height / 2)))
        if sx != 1:
            layer = layer.resize((round(layer.width * sx), round(layer.height * sx)), Image.LANCZOS)
        frame.alpha_composite(layer, (round(ox - 100 * sx), round(oy - 100 * sx)))

        # headline: "BLANK WALL?" → pack name
        if t < t_place:
            pop(frame, hook, W / 2, 270, t / 0.4)
        elif t < t_end:
            pop(frame, kicker, W / 2, 200, (t - t_place) / 0.4)
            pop(frame, title, W / 2, 295, (t - t_place - 0.1) / 0.45)

        # what's inside (under the collage)
        if t_info <= t < t_end:
            pop(frame, count, W / 2, CY + CH + 80, (t - t_info) / 0.45)
            pop(frame, sizes, W / 2, CY + CH + 150, (t - t_info - 0.25) / 0.45)

        # end card
        if t >= t_end:
            te = t - t_end
            base = 250 + CH * 0.62 + 60
            pop(frame, title, W / 2, 180, 1)
            pop(frame, price, W / 2 - (compare.width / 2 + 10 if compare else 0), base + 90, (te - 0.45) / 0.45)
            if compare:
                pop(frame, compare, W / 2 + price.width / 2 - 10, base + 110, (te - 0.55) / 0.45)
                pop(frame, badge, W / 2, base + 225, (te - 0.7) / 0.45)
            pop(frame, cta, W / 2, base + 360, (te - 0.9) / 0.45)
            if te > 1.1:
                lb = Image.new("RGBA", (logo.width + 18 + brand.width, max(logo.height, brand.height)), (0, 0, 0, 0))
                lb.alpha_composite(logo, (0, (lb.height - logo.height) // 2))
                lb.alpha_composite(brand, (logo.width + 18, (lb.height - brand.height) // 2))
                pop(frame, lb, W / 2, base + 500, (te - 1.1) / 0.45)

        frame.convert("RGB").save(os.path.join(frames_dir, f"frame-{fi:05d}.jpg"), quality=93)
        if fi == round((t_end + 2.6) * FPS):
            cover = frame.convert("RGB")
    return nframes, cover

def make(slug):
    pack = load_pack(slug)
    os.makedirs(OUT, exist_ok=True)
    frames_dir = tempfile.mkdtemp(prefix="reel-")
    try:
        nframes, cover = render(pack, frames_dir)
        out = os.path.join(OUT, f"{slug}.mp4")
        subprocess.run(["swift", os.path.join(HERE, "encode.swift"), frames_dir, out, str(FPS)], check=True)
        cover.save(os.path.join(OUT, f"{slug}-cover.jpg"), quality=90)
        print(f"  ✔ {pack['title']}: {out} ({nframes / FPS:.1f} s)")
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)

if __name__ == "__main__":
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--all" in sys.argv:
        slugs = [p["slug"] for p in get(f"{URL}/rest/v1/products?slug=like.*-poster-pack&is_active=eq.true&select=slug&order=slug")]
    if not slugs:
        print(__doc__)
        sys.exit(1)
    for s in slugs:
        make(s)
