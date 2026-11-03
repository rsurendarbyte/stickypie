"""
Makes a 9:16 Instagram reel (1080 × 1920, 30 fps, ~12 s, no sound) for a wall
poster pack from the live shop: "Blank wall?" → the posters stick on one by one
in the pack's layout → what's inside → price and stickypie.in.

  python3 scripts/pack-reel/reel.py 4x4-garage-poster-pack [more slugs…]
  python3 scripts/pack-reel/reel.py --all          → every active pack
  add --dev to read the dev database instead of prod
  --theme=NAME picks the style (default classic):
    classic      "Blank wall?" → posters stick on one by one
    night        dark garage, posters light up like spotlights
    beforeafter  plain wall → a swipe bar wipes across to the wall
    onebyone     every poster full screen with a 1/9 counter, then the wall
    zoom         close on one poster ("Wait for it…") → pulls back to the wall
    scatter      a messy pile of posters → each flies to its place

Reels land in prod_stickers/poster-packs/reels/<slug>.mp4 (classic) or
<slug>-<theme>.mp4, plus a matching -cover.jpg to use as the reel cover. Add trending audio in Instagram.
"""
import io, json, math, os, random, re, shutil, subprocess, sys, tempfile, urllib.request
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

# ---------- themes (all share the same ending: what's inside → price → stickypie.in) ----------
CW = 700                  # collage width on screen (2:3 board)
CH = round(CW * 1.5)
CX, CY = (W - CW) // 2, 370
DARK_BG = (17, 17, 19)
NIGHT_INK = (250, 248, 244)
NIGHT_MUTED = (170, 166, 160)

def setup(pack):
    """Each poster's tile at its place in the collage (screen px, collage top-left = 0, 0)."""
    n = len(pack["posters"])
    layout = LAYOUTS.get(n) or grid(math.ceil(math.sqrt(n)))
    k, gap = CW / 3, 7
    tiles = []
    for i, img in enumerate(pack["posters"]):
        x, y, w, h = layout[i]
        left, top = round(x * k + gap), round(y * k + gap)
        tw, th = round((x + w) * k - gap) - left, round((y + h) * k - gap) - top
        tile, pad = poster_tile(img, tw, th)
        tiles.append(dict(tile=tile, pad=pad, left=left, top=top, w=tw, h=th, src=img))
    return tiles

def collage_image(tiles, hs=1.0):
    """The finished collage as one picture (100 px margin each side, for shadows), drawn hs× bigger."""
    m = round(100 * hs)
    out = Image.new("RGBA", (round(CW * hs) + 2 * m, round(CH * hs) + 2 * m), (0, 0, 0, 0))
    for tl in tiles:
        if hs == 1:
            tile, pad = tl["tile"], tl["pad"]
        else:
            tile, pad = poster_tile(tl["src"], round(tl["w"] * hs), round(tl["h"] * hs))
        out.alpha_composite(tile, (m + round(tl["left"] * hs) - pad, m + round(tl["top"] * hs) - pad))
    return out

def paste_collage(frame, hi, hs, ox, oy, s):
    """Draw the collage with its top-left at (ox, oy), s screen px per collage px (only the visible part is resized)."""
    k = s / hs
    x0, y0 = ox - 100 * s, oy - 100 * s
    sx0, sy0 = max(0, x0), max(0, y0)
    sx1, sy1 = min(W, x0 + hi.width * k), min(H, y0 + hi.height * k)
    if sx1 - sx0 < 1 or sy1 - sy0 < 1:
        return
    box = ((sx0 - x0) / k, (sy0 - y0) / k, (sx1 - x0) / k, (sy1 - y0) / k)
    region = hi.resize((round(sx1 - sx0), round(sy1 - sy0)), Image.BILINEAR, box=box)
    frame.alpha_composite(region, (round(sx0), round(sy0)))

def draw_tile(frame, tl, cx, cy, scale=1.0, rot=0.0, alpha=1.0, flash=0.0):
    """One poster centred at (cx, cy) on screen, scaled / turned / faded / lit up."""
    img = tl["tile"]
    if flash > 0:
        white = Image.new("RGBA", img.size, (255, 255, 255, 0))
        white.putalpha(img.getchannel("A").point(lambda v: round(v * 0.8 * flash)))
        img = img.copy()
        img.alpha_composite(white)
    if abs(scale - 1) > 0.002:
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05:
        img = img.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        if alpha <= 0:
            return
        img = img.copy()
        img.putalpha(img.getchannel("A").point(lambda v: round(v * alpha)))
    frame.alpha_composite(img, (round(cx - img.width / 2), round(cy - img.height / 2)))

def home(tl):
    """A tile's centre on screen when the collage sits at rest."""
    return CX + tl["left"] + tl["w"] / 2, CY + tl["top"] + tl["h"] / 2

def assets(pack, dark=False):
    ink, muted = (NIGHT_INK, NIGHT_MUTED) if dark else (INK, MUTED)
    n = len(pack["posters"])
    a = dict(ink=ink, muted=muted)
    a["title"] = text_layer(pack["title"].upper(), fit_font(DISPLAY, pack["title"].upper(), W - 120, 110), ink)
    a["kicker"] = pill("WALL POSTER SET", HEAD(34), YELLOW if dark else ORANGE, INK if dark else (255, 255, 255), padx=26, pady=12)
    a["count"] = pill(f"{n} mini posters", HEAD(44), (40, 40, 44) if dark else (255, 255, 255), ink)
    a["sizes"] = text_layer(size_text(pack["sizes"]), HEAD(40), muted)
    a["price"] = text_layer(inr(pack["price"]), rounded_font(150, 900), ink)
    a["compare"] = a["badge"] = None
    if pack["compare"] and pack["compare"] > pack["price"]:
        c = text_layer(inr(pack["compare"]), rounded_font(64, 600), muted)
        ImageDraw.Draw(c).line([8, c.height // 2 + 4, c.width - 8, c.height // 2 + 4], fill=muted, width=6)
        a["compare"] = c
        a["badge"] = pill(f"SAVE {round((1 - pack['price'] / pack['compare']) * 100)}%", HEAD(40), ORANGE, (255, 255, 255), padx=26, pady=12)
    a["cta"] = pill("Shop at stickypie.in", HEAD(56), YELLOW, INK, padx=48, pady=26)
    logo = Image.open(os.path.join(ROOT, "apps/web/public/icons/icon-192.png")).convert("RGBA").resize((96, 96), Image.LANCZOS)
    brand = text_layer("StickyPie", HEAD(56), YELLOW if dark else ORANGE)
    lb = Image.new("RGBA", (logo.width + 18 + brand.width, max(logo.height, brand.height)), (0, 0, 0, 0))
    lb.alpha_composite(logo, (0, (lb.height - logo.height) // 2))
    lb.alpha_composite(brand, (logo.width + 18, (lb.height - brand.height) // 2))
    a["brand"] = lb
    return a

def show_title(frame, a, t):
    """Kicker + pack name at the top (t: seconds since they started popping in)."""
    pop(frame, a["kicker"], W / 2, 200, t / 0.4)
    pop(frame, a["title"], W / 2, 295, (t - 0.1) / 0.45)

def night_bg():
    bg = Image.new("RGB", (W, H), DARK_BG)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 620, 360, W / 2 + 620, 1500], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    warm = Image.new("RGB", (W, H), (120, 96, 60))
    return Image.composite(warm, bg, glow)

def slot_outlines(tiles, color):
    l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(l)
    for tl in tiles:
        x0, y0 = CX + tl["left"], CY + tl["top"]
        d.rounded_rectangle([x0, y0, x0 + tl["w"], y0 + tl["h"]], max(6, round(tl["w"] * 0.035)), outline=color, width=3)
    return l

def faded(layer, a):
    l = layer.copy()
    l.putalpha(l.getchannel("A").point(lambda v: round(v * a)))
    return l

def intro_night(pack, tiles, a):
    n = len(tiles)
    hook = text_layer("LIGHTS ON.", DISPLAY(124), YELLOW)
    slots = slot_outlines(tiles, (60, 58, 56, 255))
    step = min(0.32, 3.0 / n)
    t0 = 1.1
    dur = t0 + step * (n - 1) + 0.35 + 0.9
    def draw(frame, t):
        if t < t0 + step * (n - 1) + 0.3:
            frame.alpha_composite(faded(slots, 1 - clamp((t - t0) / (step * n + 0.3))))
        for i, tl in enumerate(tiles):
            p = (t - (t0 + i * step)) / 0.3
            if p <= 0:
                continue
            # flicker on: dim → bright flash → settle
            flick = 0.35 if 0.25 < p < 0.4 else 1.0
            draw_tile(frame, tl, *home(tl), alpha=clamp(p * 2.2) * flick, flash=max(0.0, 1 - clamp(p)) * 0.9)
        if t < t0:
            pop(frame, hook, W / 2, 270, t / 0.4)
        else:
            show_title(frame, a, t - (t0 + step * (n - 1) + 0.2))
    return dur, draw

def intro_beforeafter(pack, tiles, a, collage_full):
    before = text_layer("BEFORE", DISPLAY(130), INK)
    tag_b = pill("BEFORE", HEAD(36), (255, 255, 255), INK, padx=24, pady=12)
    tag_a = pill("AFTER", HEAD(36), ORANGE, (255, 255, 255), padx=24, pady=12)
    wall = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(wall).rounded_rectangle([CX - 20, CY - 20, CX + CW + 20, CY + CH + 20], 26, fill=(244, 236, 228, 255), outline=(226, 214, 204, 255), width=3)
    t_wipe, wipe = 1.4, 1.6
    dur = t_wipe + wipe + 1.0
    x_from, x_to = CX - 60, CX + CW + 60
    def draw(frame, t):
        p = ease_in_out(clamp((t - t_wipe) / wipe))
        bx = round(x_from + (x_to - x_from) * p)
        if p < 1:
            frame.alpha_composite(wall.crop((bx, 0, W, H)), (bx, 0))
        if p > 0:
            frame.alpha_composite(collage_full.crop((0, 0, max(1, bx), H)), (0, 0))
        if 0 < p < 1:
            d = ImageDraw.Draw(frame)
            d.rounded_rectangle([bx - 4, CY - 60, bx + 4, CY + CH + 60], 4, fill=(255, 255, 255, 255))
            cy = CY + CH / 2
            d.ellipse([bx - 44, cy - 44, bx + 44, cy + 44], fill=ORANGE, outline=(255, 255, 255), width=6)
            d.text((bx, cy - 4), "‹ ›", font=HEAD(44), fill=(255, 255, 255), anchor="mm")
            frame.alpha_composite(tag_a, (bx - tag_a.width - 30, CY + 30))
            frame.alpha_composite(tag_b, (bx + 30, CY + 30))
        if t < t_wipe + 0.2:
            pop(frame, before, W / 2, 270, t / 0.4)
            if t < t_wipe:
                frame.alpha_composite(tag_b, (round(W / 2 - tag_b.width / 2), round(CY + CH / 2 - tag_b.height / 2)))
        else:
            show_title(frame, a, t - t_wipe - 0.4)
    return dur, draw

def intro_onebyone(pack, tiles, a):
    n = len(tiles)
    BW, BH = 680, 1020
    bigs = [poster_tile(img, BW, BH) for img in pack["posters"]]
    head = text_layer("WHAT'S INSIDE?", DISPLAY(96), INK)
    step = min(0.7, 6.0 / n)
    t_all = n * step
    t_done = t_all + 0.75
    dur = t_done + 0.9
    BX, BY = W / 2, 380 + BH / 2
    def draw(frame, t):
        if t < t_all:
            for i in range(n):
                p_in = clamp((t - i * step) / 0.28)
                p_out = clamp((t - (i + 1) * step) / 0.28) if i < n - 1 else 0
                if p_in <= 0 or p_out >= 1:
                    continue
                x = (W + 480) + (BX - W - 480) * ease_out(p_in)
                x += (-480 - BX) * ease_in_out(p_out)
                rot = 7 * (1 - ease_out(p_in)) - 7 * p_out
                img, pad = bigs[i]
                tl = dict(tile=img)
                draw_tile(frame, tl, x, BY, rot=rot)
            cur = min(n, int(t / step) + 1)
            pop(frame, head, W / 2, 230, t / 0.4)
            counter = pill(f"{cur} / {n}", HEAD(46), INK, (255, 255, 255), padx=30, pady=14)
            frame.alpha_composite(counter, (round(W / 2 - counter.width / 2), round(BY + BH / 2 + 34)))
        else:
            e = ease_in_out(clamp((t - t_all) / 0.75))
            last = n - 1
            for i, tl in enumerate(tiles):
                hx, hy = home(tl)
                if i != last:
                    draw_tile(frame, tl, hx, hy, scale=0.85 + 0.15 * e, alpha=e)
            # the last poster on top while it lands
            hx, hy = home(tiles[last])
            draw_tile(frame, tiles[last], BX + (hx - BX) * e, BY + (hy - BY) * e, scale=(BW / tiles[last]["w"]) * (1 - e) + e)
            show_title(frame, a, t - t_all - 0.3)
    return dur, draw

def intro_zoom(pack, tiles, a, hi, hs):
    hook = text_layer("WAIT FOR IT…", DISPLAY(104), (255, 255, 255), stroke=10, stroke_fill=INK)
    z0, t0, t1 = 3.4, 0.4, 4.4
    first = tiles[0]
    fx, fy = first["left"] + first["w"] / 2, first["top"] + first["h"] / 2
    dur = t1 + 1.0
    def draw(frame, t):
        e = ease_in_out(clamp((t - t0) / (t1 - t0)))
        s = z0 + (1 - z0) * e
        cx = fx + (CW / 2 - fx) * e
        cy = fy + (CH / 2 - fy) * e
        paste_collage(frame, hi, hs, W / 2 - cx * s, CY + CH / 2 - cy * s, s)
        if t < t1 - 0.3:
            pop(frame, hook, W / 2, 230, t / 0.4)
        else:
            show_title(frame, a, t - t1 + 0.3)
    return dur, draw

def intro_scatter(pack, tiles, a):
    n = len(tiles)
    rnd = random.Random(pack["slug"])
    pile = [(W / 2 + rnd.uniform(-230, 230), 900 + rnd.uniform(-300, 300), rnd.uniform(-28, 28)) for _ in tiles]
    hook1 = text_layer("FROM A PILE…", DISPLAY(104), INK)
    hook2 = text_layer("…TO A WALL.", DISPLAY(104), ORANGE)
    t_drop, t_go = 0.1, 1.9
    s2 = min(0.18, 1.8 / n)
    t_done = t_go + s2 * (n - 1) + 0.55
    dur = t_done + 1.0
    def draw(frame, t):
        moving, resting, piled = [], [], []
        for i, tl in enumerate(tiles):
            pd = (t - (t_drop + i * 0.07)) / 0.35
            if pd <= 0:
                continue
            px, py, pr = pile[i]
            pm = clamp((t - (t_go + i * s2)) / 0.55)
            if pm <= 0:
                piled.append((i, tl, px, py - 500 * (1 - ease_out_back(clamp(pd), 1.2)), pr, 0.92))
            else:
                e = ease_in_out(pm)
                hx, hy = home(tl)
                item = (i, tl, px + (hx - px) * e, py + (hy - py) * e, pr * (1 - e), 0.92 + 0.08 * e)
                (resting if pm >= 1 else moving).append(item)
        for _, tl, x, y, r, s in resting + piled + moving:
            draw_tile(frame, tl, x, y, scale=s, rot=r)
        if t < t_go:
            pop(frame, hook1, W / 2, 230, t / 0.4)
        elif t < t_done - 0.2:
            pop(frame, hook2, W / 2, 230, (t - t_go) / 0.4)
        else:
            show_title(frame, a, t - t_done + 0.2)
    return dur, draw

def render_theme(pack, frames_dir, theme):
    tiles = setup(pack)
    dark = theme == "night"
    a = assets(pack, dark)
    bg = night_bg() if dark else background()
    hi = collage_image(tiles)
    collage_full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    paste_collage(collage_full, hi, 1, CX, CY, 1)
    if theme == "night":
        dur, intro = intro_night(pack, tiles, a)
    elif theme == "beforeafter":
        dur, intro = intro_beforeafter(pack, tiles, a, collage_full)
    elif theme == "onebyone":
        dur, intro = intro_onebyone(pack, tiles, a)
    elif theme == "zoom":
        hs = 2.4
        dur, intro = intro_zoom(pack, tiles, a, collage_image(tiles, hs), hs)
    elif theme == "scatter":
        dur, intro = intro_scatter(pack, tiles, a)
    else:
        raise SystemExit(f"unknown theme {theme}")

    t_info, t_end = dur, dur + 2.4
    total = t_end + 3.4
    nframes = round(total * FPS)
    cover = None
    for fi in range(nframes):
        t = fi / FPS
        frame = bg.copy().convert("RGBA")
        if t < t_info:
            intro(frame, t)
        else:
            # what's inside, then the price card (same for every theme)
            if t < t_end:
                z = 1 + 0.05 * ease_in_out(clamp((t - t_info) / (t_end - t_info)))
                paste_collage(frame, hi, 1, CX - CW * (z - 1) / 2, CY - CH * (z - 1) / 2, z)
                show_title(frame, a, 9)
                pop(frame, a["count"], W / 2, CY + CH + 80, (t - t_info) / 0.45)
                pop(frame, a["sizes"], W / 2, CY + CH + 150, (t - t_info - 0.25) / 0.45)
            else:
                te = t - t_end
                e = ease_in_out(clamp(te / 0.7))
                z0, z1 = 1.05, 0.62
                s = z0 + (z1 - z0) * e
                ox0, oy0 = CX - CW * (z0 - 1) / 2, CY - CH * (z0 - 1) / 2
                ox1, oy1 = (W - CW * z1) / 2, 250
                paste_collage(frame, hi, 1, ox0 + (ox1 - ox0) * e, oy0 + (oy1 - oy0) * e, s)
                pop(frame, a["title"], W / 2, 180, 1)
                base = 250 + CH * 0.62 + 60
                c = a["compare"]
                pop(frame, a["price"], W / 2 - (c.width / 2 + 10 if c else 0), base + 90, (te - 0.45) / 0.45)
                if c:
                    pop(frame, c, W / 2 + a["price"].width / 2 - 10, base + 110, (te - 0.55) / 0.45)
                    pop(frame, a["badge"], W / 2, base + 225, (te - 0.7) / 0.45)
                pop(frame, a["cta"], W / 2, base + 360, (te - 0.9) / 0.45)
                pop(frame, a["brand"], W / 2, base + 500, (te - 1.1) / 0.45)
        frame.convert("RGB").save(os.path.join(frames_dir, f"frame-{fi:05d}.jpg"), quality=93)
        if fi == round((t_end + 2.6) * FPS):
            cover = frame.convert("RGB")
    return nframes, cover

THEMES = ["classic", "night", "beforeafter", "onebyone", "zoom", "scatter"]

def make(slug, theme="classic"):
    pack = load_pack(slug)
    os.makedirs(OUT, exist_ok=True)
    frames_dir = tempfile.mkdtemp(prefix="reel-")
    name = slug if theme == "classic" else f"{slug}-{theme}"
    try:
        nframes, cover = render(pack, frames_dir) if theme == "classic" else render_theme(pack, frames_dir, theme)
        out = os.path.join(OUT, f"{name}.mp4")
        subprocess.run(["swift", os.path.join(HERE, "encode.swift"), frames_dir, out, str(FPS)], check=True)
        cover.save(os.path.join(OUT, f"{name}-cover.jpg"), quality=90)
        print(f"  ✔ {pack['title']} ({theme}): {out} ({nframes / FPS:.1f} s)")
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)

if __name__ == "__main__":
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--all" in sys.argv:
        slugs = [p["slug"] for p in get(f"{URL}/rest/v1/products?slug=like.*-poster-pack&is_active=eq.true&select=slug&order=slug")]
    if not slugs:
        print(__doc__)
        sys.exit(1)
    theme = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--theme=")), "classic")
    if theme not in THEMES:
        print(f"unknown theme {theme}; pick one of {', '.join(THEMES)}")
        sys.exit(1)
    for s in slugs:
        make(s, theme)
