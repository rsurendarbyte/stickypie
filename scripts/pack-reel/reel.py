"""
Makes a 9:16 Instagram reel (1080 × 1920, 30 fps, ~12 s, no sound) for a wall
set or poster pack from the live shop: "Blank wall?" → the posters go up on the
set's painted wall, each at its saved place and true 4 × 6 or 6 × 9 size → what's
inside → price and stickypie.in.

  python3 scripts/pack-reel/reel.py night-garage-wall-setup 4x4-garage-poster-pack [more slugs…]
  python3 scripts/pack-reel/reel.py --all          → every active wall set and pack
  add --dev to read the dev database instead of prod
  add --caption-only to only (re)write the Instagram caption, without making the video
  --design=NAME picks the look, with any style (default wall):
    wall         the set's painted wall, name on top, price card at the end
    shop         the shop's wall page: cream page, no wall, size chips, then the buy panel slides up
    sizemap      goes to the shop's Size map: posters fade back, sizes on tags, measured in cm
    bold         dark, the wall up top with a huge name under it
  --theme=NAME picks the style (default classic):
    classic      "Blank wall?" → posters stick on one by one
    sweep        the whole wall glides round from the side, posters landing as it turns
    doors        each poster swings open on its left edge, in a wave
    pull         close on the biggest poster, pulls back as the rest fade in
    deal         a stack in the middle deals out to each poster's place
    night        dark garage, posters light up like spotlights
    beforeafter  plain wall → a swipe bar wipes across to the wall
    onebyone     every poster full screen with a 1/9 counter, then the wall
    zoom         close on one poster ("Wait for it…") → pulls back to the wall
    scatter      a messy pile of posters → each flies to its place
    polaroid     posters swing in on strings with pegs, then become the wall
    quickcuts    fast full-screen cuts on flashing colours, then the wall slams in
    flip         orange StickyPie cards flip over in a wave to show the posters
    rows         rows of posters slide in from alternating sides

Reels land in prod_stickers/poster-packs/reels/<slug>.mp4 (classic on wall) or
<slug>-<theme>-<design>.mp4 (leaving out classic and wall), plus a matching -cover.jpg to use as the reel cover and -caption.txt to paste in Instagram. Add trending audio in Instagram.
"""
import io, json, math, os, random, re, shutil, subprocess, sys, tempfile, urllib.request
import numpy as np
from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFilter, ImageFont

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

# Same collage layouts as scripts/create-poster-packs.mjs (a 3 × 4.5 board), for a pack with no saved wall spots.
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

def tag_value(tags, name):
    return next((t[len(name) + 6:] for t in tags if t.startswith(f"wall {name}:")), None)

def load_pack(slug, images=True):
    [p] = get(f"{URL}/rest/v1/products?slug=eq.{slug}&select=slug,name,price,compare_at_price,image_url,pack_items,pack_sizes,tags")
    rows = get(f"{URL}/rest/v1/products?id=in.({','.join(p['pack_items'])})&select=id,name,display_url,image_url")
    by_id = {r["id"]: r for r in rows}
    posters, names = [], []
    tags = p.get("tags") or []
    spots = [[float(v) for v in spot.split(",")] for spot in (tag_value(tags, "spots") or "").split(";") if spot]
    cuts = None  # a poster taken off sale isn't readable any more, so it's cut from the set's picture, like the shop does
    for i, pid in enumerate(p["pack_items"]):
        r = by_id.get(pid)
        if r:
            names.append(re.sub(r"\s*[—-]?\s*Mini Poster$", "", r["name"]).strip())
        if not images:
            continue
        if r:
            posters.append(Image.open(io.BytesIO(get(r["display_url"] or r["image_url"], raw=True))).convert("RGBA"))
        else:
            cuts = cuts or Image.open(io.BytesIO(get(p["image_url"], raw=True))).convert("RGBA")
            x, y, w, h = spots[i]
            if "wall collage" in tags:  # an older pack's picture is its 3 × 4.5 collage
                x, y, w, h = [v * 100 / d for v, d in zip(LAYOUTS[len(p["pack_items"])][i], (3, 4.5, 3, 4.5))]
            box = [v * cuts.width / 100 for v in (x, x + w)], [v * cuts.height / 100 for v in (y, y + h)]
            posters.append(cuts.crop((round(box[0][0]), round(box[1][0]), round(box[0][1]), round(box[1][1]))))
    title = re.sub(r"\s+[—-]\s+\d+\s+Mini Poster Pack$", "", p["name"])
    title = re.sub(r"\s+Wall Setup$", "", title)
    count = len(p["pack_items"])
    sizes = [(p["pack_sizes"] or [])[i] if i < len(p["pack_sizes"] or []) else 6 for i in range(count)]
    return dict(slug=slug, title=title, price=p["price"], compare=p["compare_at_price"], posters=posters,
                sizes=sizes, names=names, tags=tags, count=count, spots=spots,
                paint=tag_value(tags, "paint"), feet=tag_value(tags, "size"))

# ---------- caption ----------
HOOKS = {
    "classic": "Blank wall? Fixed. 🖼️",
    "sweep": "Wall goals, coming in. ✨",
    "doors": "Open the wall. 🚪",
    "pull": "Step back and look at that. 👀",
    "deal": "Deal me in. 🃏",
    "night": "Lights on. 🔦",
    "beforeafter": "Before → After. Same wall, whole new vibe. ✨",
    "onebyone": "Every poster in the {title} set 👇",
    "zoom": "Wait for it… 👀",
    "scatter": "From a pile to a wall in seconds. 🧩",
    "polaroid": "Hang it up. 📸",
    "quickcuts": "{n} posters. 1 wall. 🔥",
    "flip": "Flip to see what's inside 🔄",
    "rows": "Row by row, wall done. ✅",
}
BASE_TAGS = ["wallposters", "posterwall", "wallcollage", "roomdecor", "walldecor", "homedecorindia", "stickypie"]

def caption(pack, theme):
    """A ready-to-paste Instagram caption for the pack's reel."""
    n = pack["count"]
    hook = HOOKS.get(theme, HOOKS["classic"]).format(title=pack["title"], n=n)
    price = inr(pack["price"])
    if pack["compare"] and pack["compare"] > pack["price"]:
        save = round((1 - pack["price"] / pack["compare"]) * 100)
        price += f" (was {inr(pack['compare'])}, save {save}%)"
    names = [nm.split(" — ")[0].strip() for nm in pack["names"]]
    inside = ", ".join(names[:3]) + (f" + {n - 3} more" if n > 3 else "")
    own = []
    for tg in pack["tags"]:
        tag = re.sub(r"[^a-z0-9]", "", tg.lower())
        if ":" not in tg and tag and tag not in ("posterpack", "wallcollage", "wallsetup") and tag not in own:
            own.append(tag)
    tags = " ".join("#" + x for x in (own[:6] + [b for b in BASE_TAGS if b not in own]))
    return "\n".join([
        hook,
        "",
        f"{pack['title']}: {n} wall posters, {size_text(pack['sizes'])}" + (f", {pack['feet']} on the wall." if pack["feet"] else "."),
        f"Inside: {inside}.",
        "Premium poster paper, glue dots or double-sided tape included.",
        f"One set, one price: {price}.",
        "",
        "Ships across India 🇮🇳 Shop at stickypie.in (link in bio)",
        "",
        tags,
    ]) + "\n"

def reel_name(slug, theme, design):
    return "-".join([slug] + ([theme] if theme != "classic" else []) + ([design] if design != "wall" else []))

def write_caption(pack, theme, design="wall"):
    path = os.path.join(OUT, f"{reel_name(pack['slug'], theme, design)}-caption.txt")
    os.makedirs(OUT, exist_ok=True)
    with open(path, "w") as f:
        f.write(caption(pack, theme))
    return path

# ---------- drawing helpers ----------
def ease_out_back(t, s=1.6):
    t -= 1
    return t * t * ((s + 1) * t + s) + 1

def ease_out(t):
    return 1 - (1 - t) ** 3

def ease_out_long(t):
    return 1 - (1 - t) ** 4

def ease_in_out(t):
    return 3 * t * t - 2 * t * t * t

def clamp(t):
    return max(0.0, min(1.0, t))

def paint_bg(paint):
    """The set's wall: its paint from corner to corner, fine grain, one soft light from the top left."""
    a, b = [ImageColor.getrgb(c) for c in paint.split(",")]
    across = ImageChops.add(Image.linear_gradient("L").resize((W, H)), Image.linear_gradient("L").rotate(90).resize((W, H)), scale=2)
    wall = Image.composite(Image.new("RGB", (W, H), b), Image.new("RGB", (W, H), a), across)
    light = Image.new("L", (W, H), 0)
    ImageDraw.Draw(light).ellipse([-300, -300, 700, 900], fill=60)
    wall = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), wall, light.filter(ImageFilter.GaussianBlur(220)))
    return ImageChops.soft_light(wall, Image.merge("RGB", [Image.effect_noise((W, H), 6)] * 3))

def background():
    bg = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(bg)
    for y in range(18, H, 36):
        for x in range(18, W, 36):
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=DOT)
    return bg

def corner(w):
    """Posters show whole, so the frame follows the art's own rounded corners (same as the shop)."""
    return max(4, round(w * 0.0327))

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
    r = corner(w)
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
    """How many of each size, as the shop says it: "2 pcs 6×9 + 4 pcs 4×6 in"."""
    parts = [(sum(1 for s in sizes if s == inches), label) for inches, label in ((9, "6×9"), (6, "4×6"))]
    return " + ".join(f"{c} {'pc' if c == 1 else 'pcs'} {label}" for c, label in parts if c) + " in"

def inr(n):
    s = str(int(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"₹{s}"

# ---------- themes (all share the same ending: what's inside → price → stickypie.in) ----------
CW, CH = 700, 1050        # the formation on screen; set for each pack by set_board
CX, CY = (W - CW) // 2, 370
BOARD_W = 900
END_H = 651               # the formation's height on the price card
DESIGNS = ["wall", "shop", "sizemap", "bold"]
# Where each design puts things: the formation's top and height, then the y of the hook,
# kicker, name and what's inside (None: just under the formation).
PLACES = {
    "wall": dict(top=370, height=1050, hook=250, kicker=200, title=295, info=None),
    "shop": dict(top=340, height=960, hook=250, kicker=190, title=272, info=None),
    "sizemap": dict(top=420, height=950, hook=250, kicker=200, title=295, info=None),
    "bold": dict(top=200, height=880, hook=1240, kicker=1140, title=1250, info=1375),
}
PLACE = PLACES["wall"]
DARK_BG = (17, 17, 19)
NIGHT_INK = (250, 248, 244)
NIGHT_MUTED = (170, 166, 160)

def set_board(spots):
    """Fits the formation on screen (text stays clear of Instagram's top and caption areas); gives each spot in px from its top left."""
    global CW, CH, CX, CY
    left, top = min(s[0] for s in spots), min(s[1] for s in spots)
    width = max(s[0] + s[2] for s in spots) - left
    height = max(s[1] + s[3] for s in spots) - top
    k = min(BOARD_W / width, PLACE["height"] / height)
    CW, CH = round(width * k), round(height * k)
    CX, CY = (W - CW) // 2, PLACE["top"] + (PLACE["height"] - CH) // 2
    return [[(x - left) * k, (y - top) * k, w * k, h * k] for x, y, w, h in spots]

def setup(pack):
    """Each poster's tile at its place in the formation (screen px, formation top-left = 0, 0)."""
    n = len(pack["posters"])
    layout = LAYOUTS.get(n) or grid(math.ceil(math.sqrt(n)))
    spots = set_board(pack["spots"][:n] if len(pack["spots"]) >= n else [[x + 0.03, y + 0.03, w - 0.06, h - 0.06] for x, y, w, h in layout[:n]])
    tiles = []
    for i, img in enumerate(pack["posters"]):
        x, y, w, h = spots[i]
        left, top = round(x), round(y)
        tw, th = round(x + w) - left, round(y + h) - top
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

def warp(frame, img, quad):
    """Draw img with its corners (top left, top right, bottom right, bottom left) on these screen points."""
    x0, y0 = max(0, math.floor(min(p[0] for p in quad))), max(0, math.floor(min(p[1] for p in quad)))
    x1, y1 = min(W, math.ceil(max(p[0] for p in quad))), min(H, math.ceil(max(p[1] for p in quad)))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    iw, ih = img.size
    rows, ends = [], []
    for (sx, sy), (dx, dy) in zip([(0, 0), (iw, 0), (iw, ih), (0, ih)], quad):
        dx, dy = dx - x0, dy - y0
        rows += [[dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy], [0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]]
        ends += [sx, sy]
    coeffs = np.linalg.solve(np.array(rows, float), np.array(ends, float))
    frame.alpha_composite(img.transform((x1 - x0, y1 - y0), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC), (x0, y0))

def turned(x, y, ry, rx, far):
    """A point on a flat wall (from its turning point) after the shop's rotateY + rotateX, seen from `far` px away."""
    ry, rx = math.radians(ry), math.radians(rx)
    ty, tz = y * math.cos(rx), y * math.sin(rx)
    tx, z = x * math.cos(ry) + tz * math.sin(ry), -x * math.sin(ry) + tz * math.cos(ry)
    k = far / (far - z)
    return tx * k, ty * k

def home(tl):
    """A tile's centre on screen when the collage sits at rest."""
    return CX + tl["left"] + tl["w"] / 2, CY + tl["top"] + tl["h"] / 2

def wall_chips(pack, ink, line):
    """The size boxes from the shop's wall page: 6 × 9 in / 2 pcs, 4 × 6 in / 4 pcs, Wall space / 1.2 × 1.5 ft."""
    big = sum(1 for s in pack["sizes"] if s == 9)
    small = len(pack["sizes"]) - big
    boxes = [(label, f"{c} {'pc' if c == 1 else 'pcs'}") for label, c in (("6 × 9 in", big), ("4 × 6 in", small)) if c]
    if pack["feet"]:
        boxes.append(("Wall space", pack["feet"]))
    bw, bh, gap = 300 if len(boxes) == 3 else 340, 132, 18
    out = Image.new("RGBA", (bw * len(boxes) + gap * (len(boxes) - 1), bh + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for i, (label, value) in enumerate(boxes):
        x = i * (bw + gap)
        d.rounded_rectangle([x, 4, x + bw - 1, bh], 30, fill=(255, 255, 255, 255), outline=line, width=3)
        d.text((x + 28, 26), label, font=rounded_font(30, 500), fill=MUTED)
        d.text((x + 28, 66), value, font=fit_font(lambda z: rounded_font(z, 800), value, bw - 50, 44), fill=ink)
    return out

def buy_panel(pack, a):
    """The shop's buy panel: name, price, size boxes, button, what you get. White, rounded on top."""
    m, pw = 60, W - 120
    panel = Image.new("RGBA", (W, 1140), (0, 0, 0, 0))
    glow = Image.new("L", panel.size, 0)
    ImageDraw.Draw(glow).rounded_rectangle([0, 30, W, 1300], 56, fill=70)
    panel.putalpha(glow.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle([0, 30, W, 1300], 56, fill=(255, 255, 255, 255))
    name = pack["title"] + " Wall" if not pack["title"].endswith("Wall") else pack["title"]
    d.text((m, 72), name, font=fit_font(lambda z: rounded_font(z, 800), name, pw, 78), fill=INK)
    price = text_layer(inr(pack["price"]), rounded_font(104, 900), ORANGE, pad=0)
    panel.alpha_composite(price, (m, 176))
    x = m + price.width + 26
    if pack["compare"] and pack["compare"] > pack["price"]:
        c = text_layer(inr(pack["compare"]), rounded_font(54, 600), MUTED, pad=4)
        ImageDraw.Draw(c).line([2, c.height // 2 + 2, c.width - 2, c.height // 2 + 2], fill=MUTED, width=5)
        panel.alpha_composite(c, (x, 212))
        panel.alpha_composite(a["badge"], (x + c.width + 24, 208))
    panel.alpha_composite(a["chips"], ((W - a["chips"].width) // 2, 322))
    d.rounded_rectangle([m, 494, m + pw, 610], 34, fill=YELLOW)
    d.text((W / 2, 552), "Shop at stickypie.in", font=rounded_font(52, 800), fill=INK, anchor="mm")
    perks = ["Premium poster paper", "Glue dots or tape included", "Walls, doors & cupboards", "Ships in 2–4 days"]
    for i, perk in enumerate(perks):
        px, py = m + 6 + (i % 2) * 490, 648 + (i // 2) * 54
        d.ellipse([px, py + 8, px + 20, py + 28], fill=(18, 161, 80))
        d.text((px + 34, py), perk, font=rounded_font(32, 500), fill=MUTED)
    return panel

def shop_bg():
    """The shop's page: cream dots with a warm yellow glow from the top left."""
    bg = background()
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-500, -500, 800, 800], fill=120)
    return Image.composite(Image.new("RGB", (W, H), (255, 232, 160)), bg, glow.filter(ImageFilter.GaussianBlur(200)))

def assets(pack, dark=False, design="wall"):
    # plain ink reads better than the muted brown on a painted wall
    painted = design == "wall" and pack["paint"]
    ink, muted = (NIGHT_INK, NIGHT_MUTED) if dark else (INK, INK if painted else MUTED)
    n = len(pack["posters"])
    a = dict(ink=ink, muted=muted, slot=(120, 114, 108, 255) if dark else (255, 255, 255, 215) if painted else (214, 196, 188, 255))
    if design == "bold":
        a["title"] = text_layer(pack["title"].upper(), fit_font(DISPLAY, pack["title"].upper(), W - 90, 170), YELLOW)
    else:
        a["title"] = text_layer(pack["title"].upper(), fit_font(DISPLAY, pack["title"].upper(), W - 120, 110), ink)
    a["kicker"] = pill("WALL POSTER SET", HEAD(34), YELLOW if dark else ORANGE, INK if dark else (255, 255, 255), padx=26, pady=12)
    a["count"] = pill(f"{n} wall posters", HEAD(44), (40, 40, 44) if dark else (255, 255, 255), ink)
    line = size_text(pack["sizes"]) + (f"  ·  {pack['feet']}" if pack["feet"] else "")
    a["sizes"] = text_layer(line, fit_font(HEAD, line, W - 120, 40), muted)
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
    if design == "shop":
        a["chips"] = wall_chips(pack, INK, (234, 223, 215, 255))
        if a["badge"] is None:
            a["badge"] = pill("WALL SET", HEAD(40), ORANGE, (255, 255, 255), padx=26, pady=12)
        a["panel"] = buy_panel(pack, a)
    return a

def show_title(frame, a, t):
    """Kicker + pack name at the top (t: seconds since they started popping in)."""
    pop(frame, a["kicker"], W / 2, PLACE["kicker"], t / 0.4)
    pop(frame, a["title"], W / 2, PLACE["title"], (t - 0.1) / 0.45)

def size_map(pack, tiles, a):
    """The shop's Size map at the formation's place: each poster faded back with its size on a tag, measured in cm."""
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ink = a["ink"]
    for i, tl in enumerate(tiles):
        art = Image.blend(Image.new("L", tl["src"].size, 255), tl["src"].convert("L"), 0.38).convert("RGBA")
        tile, pad = poster_tile(art, tl["w"], tl["h"])
        out.alpha_composite(tile, (CX + tl["left"] - pad, CY + tl["top"] - pad))
        big = pack["sizes"][i] == 9
        tag = pill("6×9 in" if big else "4×6 in", HEAD(max(24, min(46, round(tl["w"] * 0.15)))), INK if big else (255, 255, 255), (255, 255, 255) if big else INK, padx=18, pady=10)
        out.alpha_composite(tag, (round(CX + tl["left"] + tl["w"] / 2 - tag.width / 2), round(CY + tl["top"] + tl["h"] / 2 - tag.height / 2)))
    spots = pack["spots"]
    # a poster's real size gives the scale, across and down (same sums as the shop)
    across = (6 if pack["sizes"][0] == 9 else 4) / spots[0][2]
    down = (9 if pack["sizes"][0] == 9 else 6) / spots[0][3]
    wide = round((max(s[0] + s[2] for s in spots) - min(s[0] for s in spots)) * across * 2.54)
    tall = round((max(s[1] + s[3] for s in spots) - min(s[1] for s in spots)) * down * 2.54)
    def ruler(length, label):
        """A dimension line with its length in the middle, drawn across."""
        tag = text_layer(label, HEAD(38), ink, pad=8)
        l = Image.new("RGBA", (length, tag.height), (0, 0, 0, 0))
        d = ImageDraw.Draw(l)
        mid = l.height // 2
        d.line([(0, mid), (length, mid)], fill=ink, width=4)
        d.line([(1, mid - 12), (1, mid + 12)], fill=ink, width=4)
        d.line([(length - 2, mid - 12), (length - 2, mid + 12)], fill=ink, width=4)
        d.rectangle([(length - tag.width) // 2 - 10, 0, (length + tag.width) // 2 + 10, l.height], fill=(0, 0, 0, 0))
        l.alpha_composite(tag, ((length - tag.width) // 2, 0))
        return l
    top = ruler(CW, f"{wide} cm")
    out.alpha_composite(top, (CX, CY - top.height - 12))
    side = ruler(CH, f"{tall} cm").rotate(90, expand=True)
    out.alpha_composite(side, (max(0, CX - side.width - 10), CY))
    words = f"To scale · {size_text(pack['sizes'])} · covers about {wide} × {tall} cm"
    note = text_layer(words, fit_font(HEAD, words, W - 90, 40), ink)
    out.alpha_composite(note, ((W - note.width) // 2, CY + CH + 40))
    return out

def night_bg():
    bg = Image.new("RGB", (W, H), DARK_BG)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 620, 360, W / 2 + 620, 1500], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    warm = Image.new("RGB", (W, H), (120, 96, 60))
    return Image.composite(warm, bg, glow)

def slot_outlines(tiles, color):
    """A dashed outline where each poster will go."""
    l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(l)
    for tl in tiles:
        x0, y0 = CX + tl["left"], CY + tl["top"]
        x1, y1 = x0 + tl["w"], y0 + tl["h"]
        d.rectangle([x0, y0, x1, y1], fill=color[:3] + (28,))
        for x in range(x0, x1, 22):
            d.line([(x, y0), (min(x + 12, x1), y0)], fill=color, width=3)
            d.line([(x, y1), (min(x + 12, x1), y1)], fill=color, width=3)
        for y in range(y0, y1, 22):
            d.line([(x0, y), (x0, min(y + 12, y1))], fill=color, width=3)
            d.line([(x1, y), (x1, min(y + 12, y1))], fill=color, width=3)
    return l

def faded(layer, a):
    l = layer.copy()
    l.putalpha(l.getchannel("A").point(lambda v: round(v * a)))
    return l

def left_to_right(tiles):
    return sorted(range(len(tiles)), key=lambda i: (tiles[i]["left"] + tiles[i]["w"] / 2, tiles[i]["top"]))

def intro_classic(pack, tiles, a):
    n = len(tiles)
    hook = text_layer("BLANK WALL?", DISPLAY(118), a["ink"])
    slots = slot_outlines(tiles, a["slot"])
    t0 = 1.0
    step = min(0.42, 3.4 / n)
    t_built = t0 + step * (n - 1) + 0.5
    def draw(frame, t):
        if t < t_built + 0.4:
            frame.alpha_composite(faded(slots, 1 - clamp((t - t0) / (t_built - t0 + 0.4))))
        for i, tl in enumerate(tiles):
            p = clamp((t - (t0 + i * step)) / 0.45)
            if p <= 0:
                continue
            hx, hy = home(tl)
            draw_tile(frame, tl, hx, hy - 70 * (1 - ease_out(p)), scale=1.35 - 0.35 * ease_out_back(p, 1.3),
                      rot=(8 if i % 2 else -8) * (1 - ease_out(p)), alpha=clamp(p * 3))
        if t < t0:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t0)
    return t_built + 0.2, draw

def intro_sweep(pack, tiles, a):
    """The whole wall glides round from the side, posters landing as it turns."""
    n = len(tiles)
    hook = text_layer("WALL GOALS.", DISPLAY(118), a["ink"])
    outlines = slot_outlines(tiles, a["slot"]).crop((CX - 100, CY - 100, CX + CW + 100, CY + CH + 100))
    order = left_to_right(tiles)
    t0, swing = 0.7, 2.5
    step = min(0.16, 1.7 / n)
    t_title = t0 + 1.5
    far = CW * 1.8
    cx, cy = CX + CW / 2, CY + CH / 2
    def draw(frame, t):
        e = ease_out_long(clamp((t - t0) / swing))
        wall = faded(outlines, 1 - clamp((t - t0) / (step * n + 0.6)))
        for k, i in enumerate(order):
            p = clamp((t - t0 - 0.1 - k * step) / 0.55)
            if p <= 0:
                continue
            tl = tiles[i]
            spot = (100 + tl["left"] - tl["pad"] + round(30 * (1 - ease_out(p))), 100 + tl["top"] - tl["pad"])
            wall.alpha_composite(tl["tile"] if p >= 1 else faded(tl["tile"], p), spot)
        scale = 0.82 + 0.18 * e
        ry, rx = -34 * (1 - e), 4 * (1 - e)
        hw, hh = wall.width / 2 * scale, wall.height / 2 * scale
        corners = [turned(x, y, ry, rx, far) for x, y in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
        warp(frame, wall, [(cx + x, cy + y) for x, y in corners])
        if t < t_title:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t_title)
    return t0 + swing + 0.4, draw

def intro_doors(pack, tiles, a):
    """Each poster swings open on its left edge, in a wave."""
    n = len(tiles)
    hook = text_layer("OPEN THE WALL.", DISPLAY(104), a["ink"])
    slots = slot_outlines(tiles, a["slot"])
    order = left_to_right(tiles)
    t0, swing = 1.0, 1.0
    step = min(0.24, 2.6 / n)
    t_done = t0 + step * (n - 1) + swing
    def draw(frame, t):
        if t < t_done:
            frame.alpha_composite(faded(slots, 1 - clamp((t - t0) / (t_done - t0))))
        for k, i in enumerate(order):
            p = clamp((t - t0 - k * step) / swing)
            if p <= 0:
                continue
            tl = tiles[i]
            if p >= 1:
                draw_tile(frame, tl, *home(tl))
                continue
            ang = -82 * (1 - ease_out_long(p))
            far = tl["w"] * 3.5
            pad, img = tl["pad"], tl["tile"]
            hinge, cy = CX + tl["left"], CY + tl["top"] + tl["h"] / 2
            corners = [turned(x, y, ang, 0, far) for x, y in ((-pad, -img.height / 2), (img.width - pad, -img.height / 2), (img.width - pad, img.height / 2), (-pad, img.height / 2))]
            warp(frame, faded(img, clamp(p / 0.15)), [(hinge + x, cy + y) for x, y in corners])
        if t < t_done - 0.4:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t_done + 0.4)
    return t_done + 0.7, draw

def intro_pull(pack, tiles, a):
    """Starts close on the biggest poster, then pulls back to the whole wall as the rest fade in."""
    hs = 2.4
    hook = text_layer("STEP BACK.", DISPLAY(112), (255, 255, 255), stroke=10, stroke_fill=INK)
    big = max(range(len(tiles)), key=lambda i: tiles[i]["w"] * tiles[i]["h"])
    bx, by = tiles[big]["left"] + tiles[big]["w"] / 2, tiles[big]["top"] + tiles[big]["h"] / 2
    away = [math.hypot(tl["left"] + tl["w"] / 2 - bx, tl["top"] + tl["h"] / 2 - by) for tl in tiles]
    far = max(away) or 1
    z0 = min(2.3, 880 / tiles[big]["w"], 1200 / tiles[big]["h"])
    t0, pull = 0.9, 2.9
    starts = [t0 + 0.2 + d / far * 1.5 for d in away]
    hi = []
    for tl in tiles:
        img, pad = poster_tile(tl["src"], round(tl["w"] * hs), round(tl["h"] * hs))
        hi.append((img, (round((100 + tl["left"]) * hs) - pad, round((100 + tl["top"]) * hs) - pad)))
    wall = Image.new("RGBA", (round(CW * hs) + 2 * round(100 * hs), round(CH * hs) + 2 * round(100 * hs)), (0, 0, 0, 0))
    wall.alpha_composite(*hi[big])
    placed = {big}
    t_title = t0 + 1.7
    def draw(frame, t):
        e = ease_in_out(clamp((t - t0) / pull))
        s = z0 + (1 - z0) * e
        now = wall.copy() if len(placed) < len(tiles) else wall
        for i, (img, spot) in enumerate(hi):
            if i in placed:
                continue
            p = clamp((t - starts[i]) / 0.6)
            if p >= 1:
                wall.alpha_composite(img, spot)
                placed.add(i)
            if p > 0:
                now.alpha_composite(faded(img, p), spot)
        cx, cy = bx + (CW / 2 - bx) * e, by + (CH / 2 - by) * e
        paste_collage(frame, now, hs, W / 2 - cx * s, CY + CH / 2 - cy * s, s)
        if t < t_title:
            pop(frame, hook, W / 2, 230, t / 0.4)
        else:
            show_title(frame, a, t - t_title)
    return t0 + pull + 0.5, draw

def intro_deal(pack, tiles, a):
    """A stack in the middle deals out to each poster's place."""
    n = len(tiles)
    hook = text_layer("DEAL ME IN.", DISPLAY(118), a["ink"])
    order = left_to_right(tiles)
    tilt = [(1 if i % 2 else -1) * (4 + (i % 4) * 3) for i in range(n)]
    cx, cy = CX + CW / 2, CY + CH / 2
    t0, fly = 1.1, 0.85
    step = min(0.2, 2.4 / n)
    t_done = t0 + step * (n - 1) + fly
    def draw(frame, t):
        stack, moving = [], []
        for k, i in enumerate(order):
            p = clamp((t - t0 - k * step) / fly)
            tl = tiles[i]
            if p <= 0:
                stack.append((k, i))
            elif p >= 1:
                draw_tile(frame, tl, *home(tl))
            else:
                moving.append((i, ease_out_long(p)))
        # the next poster to go is on top of the stack
        for k, i in reversed(stack):
            drop = -120 * (1 - ease_out(clamp(t / 0.4 - k * 0.04)))
            draw_tile(frame, tiles[i], cx, cy + drop, scale=0.72, rot=tilt[i], alpha=clamp(t / 0.25 - k * 0.04))
        for i, e in moving:
            hx, hy = home(tiles[i])
            draw_tile(frame, tiles[i], cx + (hx - cx) * e, cy + (hy - cy) * e, scale=0.72 + 0.28 * e, rot=tilt[i] * (1 - e))
        if t < t_done - 0.4:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t_done + 0.4)
    return t_done + 0.7, draw

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
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - (t0 + step * (n - 1) + 0.2))
    return dur, draw

def intro_beforeafter(pack, tiles, a, collage_full):
    before = text_layer("BEFORE", DISPLAY(130), a["ink"])
    tag_b = pill("BEFORE", HEAD(36), (255, 255, 255), INK, padx=24, pady=12)
    tag_a = pill("AFTER", HEAD(36), ORANGE, (255, 255, 255), padx=24, pady=12)
    t_wipe, wipe = 1.4, 1.6
    dur = t_wipe + wipe + 1.0
    x_from, x_to = CX - 60, CX + CW + 60
    def draw(frame, t):
        p = ease_in_out(clamp((t - t_wipe) / wipe))
        bx = round(x_from + (x_to - x_from) * p)
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
            pop(frame, before, W / 2, PLACE["hook"], t / 0.4)
            if t < t_wipe:
                frame.alpha_composite(tag_b, (round(W / 2 - tag_b.width / 2), round(CY + CH / 2 - tag_b.height / 2)))
        else:
            show_title(frame, a, t - t_wipe - 0.4)
    return dur, draw

def intro_onebyone(pack, tiles, a):
    n = len(tiles)
    BW, BH = 680, 1020
    bigs = [poster_tile(img, BW, BH) for img in pack["posters"]]
    head = text_layer("WHAT'S INSIDE?", DISPLAY(96), a["ink"])
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
            counter = pill(f"{cur} / {n}", HEAD(46), ORANGE, (255, 255, 255), padx=30, pady=14)
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
    hook1 = text_layer("FROM A PILE…", DISPLAY(104), a["ink"])
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

def intro_polaroid(pack, tiles, a, collage_full):
    """Posters hang on strings like polaroids, swing to rest, then become the wall."""
    n = len(tiles)
    cols = 2 if n == 4 else (3 if n <= 9 else 5)
    rows = math.ceil(n / cols)
    top, bottom = 400, 1500
    h_avail = (bottom - top) / rows
    cellw = (W - 120) / cols
    pw = int(min(cellw * 0.8, (h_avail - 60) / 1.72))
    ph = round(pw * 1.5)
    border, chin = max(8, pw // 16), max(22, pw // 5)
    pols = []
    for img in pack["posters"]:
        photo = img.convert("RGBA")
        sw, sh = photo.size
        s = max(pw / sw, ph / sh)
        photo = photo.resize((max(pw, round(sw * s)), max(ph, round(sh * s))), Image.LANCZOS)
        photo = photo.crop(((photo.width - pw) // 2, (photo.height - ph) // 2, (photo.width - pw) // 2 + pw, (photo.height - ph) // 2 + ph))
        card = Image.new("RGBA", (pw + 2 * border, ph + border + chin), (255, 255, 255, 255))
        card.alpha_composite(photo, (border, border))
        pad = 30
        out = Image.new("RGBA", (card.width + 2 * pad, card.height + 2 * pad), (0, 0, 0, 0))
        sm = Image.new("L", out.size, 0)
        ImageDraw.Draw(sm).rectangle([pad + 4, pad + 10, pad + card.width + 4, pad + card.height + 10], fill=80)
        sh_ = Image.new("RGBA", out.size, (0, 0, 0, 0))
        sh_.putalpha(sm.filter(ImageFilter.GaussianBlur(10)))
        out.alpha_composite(sh_)
        out.alpha_composite(card, (pad, pad))
        pols.append(dict(tile=out))
    ch = ph + border + chin
    pins = []
    for i in range(n):
        r, c = divmod(i, cols)
        in_row = min(cols, n - r * cols)
        x = 60 + cellw * (c + (cols - in_row) / 2) + cellw / 2
        y = top + r * h_avail + 30
        sag = 22 * (1 - ((x - W / 2) / (W / 2)) ** 2)
        pins.append((x, y + sag))
    hook = text_layer("HANG IT UP.", DISPLAY(110), a["ink"])
    t0, step = 0.9, min(0.33, 3.0 / n)
    t_hung = t0 + step * (n - 1) + 1.1
    dur = t_hung + 0.7 + 0.8
    def draw(frame, t):
        fade = ease_in_out(clamp((t - t_hung) / 0.7))
        if fade < 1:
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            for r in range(rows):
                y0 = top + r * h_avail + 30
                pts = [(x, y0 + 22 * (1 - ((x - W / 2) / (W / 2)) ** 2)) for x in range(20, W - 19, 20)]
                d.line(pts, fill=(120, 96, 80, 255), width=3)
            for i, (pl, (px, py)) in enumerate(zip(pols, pins)):
                p = (t - (t0 + i * step)) / 0.35
                if p <= 0:
                    continue
                k = t - (t0 + i * step) - 0.35
                drop = -260 * (1 - ease_out(clamp(p)))
                rot = 16 * math.exp(-3.2 * max(0, k)) * math.cos(9 * max(0, k)) * (1 if i % 2 else -1)
                a_r = math.radians(rot)
                cx = px + (ch / 2) * math.sin(a_r)
                cy = py + drop + (ch / 2) * math.cos(a_r)
                draw_tile(layer, pl, cx, cy, rot=rot, alpha=clamp(p * 3))
                ImageDraw.Draw(layer).rounded_rectangle([px - 7, py + drop - 16, px + 7, py + drop + 14], 3, fill=(176, 128, 82, 255))
            frame.alpha_composite(faded(layer, 1 - fade) if fade > 0 else layer)
        if fade > 0:
            frame.alpha_composite(faded(collage_full, fade))
        if t < t_hung:
            pop(frame, hook, W / 2, 230, t / 0.4)
        else:
            show_title(frame, a, t - t_hung)
    return dur, draw

def intro_quickcuts(pack, tiles, a, hi):
    """Fast full-screen cuts, one poster per beat on flashing colours, then the wall slams in."""
    n = len(tiles)
    BW, BH = 700, 1050
    bigs = [poster_tile(img, BW, BH)[0] for img in pack["posters"]]
    colors = [ORANGE, YELLOW, INK, (40, 120, 200)]
    slot = min(0.34, 3.4 / n)
    t_wall = 0.5 + n * slot
    dur = t_wall + 1.3
    head = text_layer(f"{n} POSTERS.", DISPLAY(112), (255, 255, 255), stroke=10, stroke_fill=INK)
    wall = text_layer("1 WALL.", DISPLAY(112), ORANGE, stroke=10, stroke_fill=INK)
    def draw(frame, t):
        if t < t_wall:
            i = int(max(0, t - 0.5) / slot) if t >= 0.5 else -1
            if i >= 0:
                frame.paste(Image.new("RGBA", (W, H), colors[(i + 4) % len(colors)] + (255,)), (0, 0))
                p = ((t - 0.5) - i * slot) / slot
                s = 1.12 - 0.12 * ease_out(clamp(p * 2))
                draw_tile(frame, dict(tile=bigs[min(i, n - 1)]), W / 2, 960, scale=s, rot=(3 if i % 2 else -3))
            pop(frame, head, W / 2, 230, t / 0.3)
        else:
            te = t - t_wall
            e = ease_out_back(clamp(te / 0.45), 1.4)
            z = 1.25 - 0.25 * e
            paste_collage(frame, hi, 1, CX - CW * (z - 1) / 2, CY - CH * (z - 1) / 2, z)
            if te < 0.18:
                frame.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, round(255 * (1 - te / 0.18)))))
            if te < 0.8:
                pop(frame, wall, W / 2, 230, te / 0.3)
            else:
                show_title(frame, a, te - 0.8)
    return dur, draw

def intro_flip(pack, tiles, a):
    """Orange StickyPie cards flip over in a wave to show the posters."""
    logo = Image.open(os.path.join(ROOT, "apps/web/public/icons/icon-512.png")).convert("RGBA")
    backs = []
    for tl in tiles:
        back = Image.new("RGBA", (tl["w"], tl["h"]), ORANGE + (255,))
        d = ImageDraw.Draw(back)
        for y in range(-tl["w"], tl["h"], 26):
            d.line([(0, y), (tl["w"], y + tl["w"])], fill=(255, 120, 60, 255), width=8)
        s = int(min(tl["w"], tl["h"]) * 0.42)
        back.alpha_composite(logo.resize((s, s), Image.LANCZOS), ((tl["w"] - s) // 2, (tl["h"] - s) // 2))
        backs.append(dict(tile=poster_tile(back, tl["w"], tl["h"])[0]))
    hook = text_layer("FLIP IT.", DISPLAY(118), a["ink"])
    rows = sorted({tl["top"] for tl in tiles})
    colsx = sorted({tl["left"] for tl in tiles})
    delays = [0.13 * (rows.index(tl["top"]) + colsx.index(tl["left"])) for tl in tiles]
    t0, flip = 1.2, 0.42
    t_done = t0 + max(delays) + flip
    dur = t_done + 1.0
    def squash(tile, sx):
        img = tile["tile"]
        return dict(tile=img.resize((max(1, round(img.width * sx)), img.height), Image.BILINEAR))
    def draw(frame, t):
        for i, tl in enumerate(tiles):
            p = clamp((t - t0 - delays[i]) / flip)
            hx, hy = home(tl)
            pop_in = clamp(t / 0.5 - i * 0.04)
            if p < 0.5:
                sx = math.cos(p * math.pi)
                draw_tile(frame, squash(backs[i], max(0.02, sx)), hx, hy, scale=1, alpha=pop_in)
            else:
                sx = -math.cos(p * math.pi)
                draw_tile(frame, squash(tl, max(0.02, sx)), hx, hy)
        if t < t_done - 0.3:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t_done + 0.3)
    return dur, draw

def intro_rows(pack, tiles, a):
    """Rows of posters slide in from alternating sides."""
    rows = sorted({tl["top"] for tl in tiles})
    hook = text_layer("ROW BY ROW.", DISPLAY(110), a["ink"])
    t0, gap = 0.9, 0.5
    starts = []
    for i, tl in enumerate(tiles):
        r = rows.index(tl["top"])
        k = sum(1 for o in tiles[:i] if o["top"] == tl["top"])
        starts.append((t0 + r * gap + k * 0.07, -1 if r % 2 else 1))
    t_done = max(s for s, _ in starts) + 0.6
    dur = t_done + 0.9
    def draw(frame, t):
        for (st, side), tl in zip(starts, tiles):
            p = clamp((t - st) / 0.6)
            if p <= 0:
                continue
            hx, hy = home(tl)
            off = (1 - ease_out_back(p, 1.2)) * (W * 0.9) * side
            draw_tile(frame, tl, hx + off, hy, rot=-6 * side * (1 - p))
        if t < t_done - 0.3:
            pop(frame, hook, W / 2, PLACE["hook"], t / 0.4)
        else:
            show_title(frame, a, t - t_done + 0.3)
    return dur, draw

def design_bg(pack, theme, design):
    if theme == "night":
        return night_bg()
    if design == "bold":
        return Image.new("RGB", (W, H), INK)
    if design == "shop":
        return shop_bg()
    return paint_bg(pack["paint"]) if design == "wall" and pack["paint"] else background()

def render_theme(pack, frames_dir, theme, design="wall"):
    global PLACE
    PLACE = PLACES[design]
    tiles = setup(pack)
    dark = theme == "night" or design == "bold"
    a = assets(pack, dark, design)
    bg = design_bg(pack, theme, design)
    size_layer = size_map(pack, tiles, a) if design == "sizemap" and len(pack["spots"]) >= len(tiles) else None
    hi = collage_image(tiles)
    collage_full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    paste_collage(collage_full, hi, 1, CX, CY, 1)
    if theme == "classic":
        dur, intro = intro_classic(pack, tiles, a)
    elif theme == "sweep":
        dur, intro = intro_sweep(pack, tiles, a)
    elif theme == "doors":
        dur, intro = intro_doors(pack, tiles, a)
    elif theme == "pull":
        dur, intro = intro_pull(pack, tiles, a)
    elif theme == "deal":
        dur, intro = intro_deal(pack, tiles, a)
    elif theme == "night":
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
    elif theme == "polaroid":
        dur, intro = intro_polaroid(pack, tiles, a, collage_full)
    elif theme == "quickcuts":
        dur, intro = intro_quickcuts(pack, tiles, a, hi)
    elif theme == "flip":
        dur, intro = intro_flip(pack, tiles, a)
    elif theme == "rows":
        dur, intro = intro_rows(pack, tiles, a)
    else:
        raise SystemExit(f"unknown theme {theme}")

    t_info, t_end = dur, dur + (3.6 if size_layer else 2.4)
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
                z = 1 if size_layer else 1 + 0.05 * ease_in_out(clamp((t - t_info) / (t_end - t_info)))
                paste_collage(frame, hi, 1, CX - CW * (z - 1) / 2, CY - CH * (z - 1) / 2, z)
                show_title(frame, a, 9)
                if size_layer:
                    frame.alpha_composite(faded(size_layer, min(clamp((t - t_info - 0.3) / 0.5), clamp((t_end - t) / 0.35))))
                elif design == "shop":
                    pop(frame, a["chips"], W / 2, CY + CH + 110, (t - t_info) / 0.45)
                    pop(frame, a["badge"], max(CX, 150), CY + 30, (t - t_info - 0.3) / 0.45)
                else:
                    y = PLACE["info"] or CY + CH + 80
                    pop(frame, a["count"], W / 2, y, (t - t_info) / 0.45)
                    pop(frame, a["sizes"], W / 2, y + 70, (t - t_info - 0.25) / 0.45)
            elif design == "shop":
                # the formation moves up and the buy panel slides in under it
                te = t - t_end
                e = ease_in_out(clamp(te / 0.7))
                z1 = min(0.9, 560 / CH, 960 / CW)
                s = 1.05 + (z1 - 1.05) * e
                ox0, oy0 = CX - CW * 0.025, CY - CH * 0.025
                ox1, oy1 = (W - CW * z1) / 2, 200 + (560 - CH * z1) / 2
                paste_collage(frame, hi, 1, ox0 + (ox1 - ox0) * e, oy0 + (oy1 - oy0) * e, s)
                frame.alpha_composite(a["panel"], (0, round(H - 1140 * ease_out(clamp((te - 0.1) / 0.6)))))
            else:
                te = t - t_end
                e = ease_in_out(clamp(te / 0.7))
                z0, z1 = 1.05, min(0.9, END_H / CH)
                s = z0 + (z1 - z0) * e
                ox0, oy0 = CX - CW * (z0 - 1) / 2, CY - CH * (z0 - 1) / 2
                ox1, oy1 = (W - CW * z1) / 2, 250 + (END_H - CH * z1) / 2
                paste_collage(frame, hi, 1, ox0 + (ox1 - ox0) * e, oy0 + (oy1 - oy0) * e, s)
                pop(frame, a["title"], W / 2, 180, 1)
                base = 250 + END_H + 60
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

THEMES = ["classic", "sweep", "doors", "pull", "deal", "night", "beforeafter", "onebyone", "zoom", "scatter", "polaroid", "quickcuts", "flip", "rows"]

def make(slug, theme="classic", design="wall"):
    pack = load_pack(slug)
    os.makedirs(OUT, exist_ok=True)
    frames_dir = tempfile.mkdtemp(prefix="reel-")
    name = reel_name(slug, theme, design)
    try:
        nframes, cover = render_theme(pack, frames_dir, theme, design)
        out = os.path.join(OUT, f"{name}.mp4")
        subprocess.run(["swift", os.path.join(HERE, "encode.swift"), frames_dir, out, str(FPS)], check=True)
        cover.save(os.path.join(OUT, f"{name}-cover.jpg"), quality=90)
        write_caption(pack, theme, design)
        print(f"  ✔ {pack['title']} ({theme}, {design}): {out} ({nframes / FPS:.1f} s)")
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)

if __name__ == "__main__":
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--all" in sys.argv:
        slugs = [p["slug"] for p in get(f"{URL}/rest/v1/products?or=(slug.like.*-poster-pack,slug.like.*-wall-setup)&is_active=eq.true&select=slug&order=slug")]
    if not slugs:
        print(__doc__)
        sys.exit(1)
    theme = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--theme=")), "classic")
    if theme not in THEMES:
        print(f"unknown theme {theme}; pick one of {', '.join(THEMES)}")
        sys.exit(1)
    design = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--design=")), "wall")
    if design not in DESIGNS:
        print(f"unknown design {design}; pick one of {', '.join(DESIGNS)}")
        sys.exit(1)
    for s in slugs:
        if "--caption-only" in sys.argv:
            print(f"  ✔ caption: {write_caption(load_pack(s, images=False), theme, design)}")
        else:
            make(s, theme, design)
