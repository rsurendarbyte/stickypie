"""
Makes a 9:16 reel for Instagram and YouTube Shorts (1080 × 1920, 30 fps, no sound)
that sells several shop products together: stickers, mini posters and wall sets, in
the order given. Opens on a hook → the products in the chosen style, each with its
price and saving → all of them with the lowest price, the saving, Order at
stickypie.in and Link in bio. Pictures, names and prices come from the live shop.
Words and prices stay clear of the buttons and caption both apps lay over a video.

  python3 scripts/pack-reel/showcase.py --style=slap --hook="NEW DROPS" slug1 slug2 slug3 […]
  --style=NAME picks the style:
    spotlight  one product at a time springs in on its own colour, name and price below
    slap       each product slaps down with a thud until the screen is full
    carousel   a 3D carousel turns from one product to the next, on a dark stage
    swipe      a deck of shop cards, each swiped away to show the next
    beat       fast punchy cuts on brand colours, great with a beat
    scroll     tilted columns of all the products roll past each other
    walltour   wall after wall, each one's posters going up on its own paint (best with walls)
  UGC templates (phone-shot look, caption boxes, no opening plate; a hook of your own replaces the template's):
    pov        jump cuts with a POV line, each product in a caption box
    picks      a numbered list builds up under each product
    parcel     a parcel opens and the products come out one at a time
    thisorthat two products at a time, "comment 1 or 2"
    wishlist   a phone notes page, products ticked off one by one
    myclip     your own phone video or photo (--clip=FILE, up to 20 s used), product cards slide in over it
  --name=NAME  file name (default: the style and the time)
  --offer=TEXT your own line on the last screen (default: Link in bio · Ships across India)
  --no-prices  no prices or savings anywhere
  --times=1.5,,2  seconds each product stays on screen, in order; a gap keeps that one's automatic time
  --intro=SECS    length of the opening plate (animated styles; 0 starts straight on the products)
  --end=SECS      length of the last screen
  add --dev to read the dev database instead of prod

Reels land in prod_stickers/product-reels/<name>.mp4, plus -cover.jpg, -caption.txt
(Instagram), -shorts.txt (YouTube title and description) and -info.json. Reel Studio's sister page (npm run product-reels) drives this.
"""
import colorsys, io, json, math, os, random, re, shutil, subprocess, sys, tempfile, time
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import reel as r
from reel import W, H, FPS, INK, MUTED, ORANGE, YELLOW, DISPLAY, clamp, ease_in_out, ease_out, ease_out_back, ease_out_long

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(r.ROOT, "prod_stickers/product-reels")
STYLES = ["spotlight", "slap", "carousel", "swipe", "beat", "scroll", "walltour", "pov", "picks", "parcel", "thisorthat", "wishlist", "myclip"]
CLIP = None      # --clip: the shopkeeper's own video or photo for myclip
# The UGC templates' words when no hook is given. No customer quotes, ratings or
# "I bought this" lines: a made-up testimonial in an ad is a fake review.
UGC_HOOKS = dict(
    pov="POV: your room glow-up starts at {low}",
    picks="{n} picks from {low}",
    parcel="Your next parcel, from {low}",
    thisorthat="Which one? Comment 1 or 2",
    wishlist="Wishlist, from {low}",
    myclip="Look what {low} gets you",
)
HOOK = "New drops from {low}"
HOOKS = dict(walltour="Pick your wall, from {low}")

MIN_ITEMS, MAX_ITEMS = 2, 16
WHITE = (255, 255, 255)
INTRO = 1.1      # the hook's plate; --intro changes it
IRIS = 0.4       # the round wipe between parts
FINALE = 4.0     # all the products, price, stickypie.in; --end changes it
TIMES = []       # --times: seconds per product, None for automatic

# ---------- products ----------
def short_name(name):
    name = re.sub(r"\s+[—-]\s+\d+\s+Mini Poster Pack$", "", name)
    name = re.sub(r"\s+Wall Setup$", "", name)
    name = re.sub(r"\s*[—-]?\s*Mini Poster$", "", name)
    return name.split(" — ")[0].strip()

def kind_of(p):
    return "wall" if p["pack_items"] else "poster" if p["slug"].endswith("-mini-poster") else "sticker"

def saving(item):
    """Percent off, against the shop's own crossed-out price."""
    return round((1 - item["price"] / item["was"]) * 100) if item["was"] and item["was"] > item["price"] else 0

def price_of(p):
    """The lowest price it sells at; (price, was, "From " when there are several)."""
    sizes = sorted(p["sizes"] or [], key=lambda s: s["price"])
    if sizes:
        return sizes[0]["price"], sizes[0].get("compare_at_price"), len(sizes) > 1
    return p["price"], p["compare_at_price"], False

def tint_of(img):
    """The picture's strongest colour, for its backdrop."""
    small = img.convert("RGBA").resize((40, 40), Image.BILINEAR)
    best, score = (249, 83, 10), 0
    buckets = {}
    for cr, cg, cb, ca in small.getdata():
        if ca < 128:
            continue
        hue, sat, val = colorsys.rgb_to_hsv(cr / 255, cg / 255, cb / 255)
        if sat < 0.3 or val < 0.3:
            continue
        b = buckets.setdefault(round(hue * 12) % 12, [0, 0, 0, 0])
        for i, v in enumerate((cr, cg, cb, 1)):
            b[i] += v
    for b in buckets.values():
        if b[3] > score:
            score, best = b[3], (b[0] // b[3], b[1] // b[3], b[2] // b[3])
    return best

def mix(c, other, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c, other))

def fitted(item, bw, bh):
    """The product whole inside a box, with a soft shadow (stickers' follows their shape)."""
    img = item["src"]
    k = min(bw / img.width, bh / img.height)
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    pic = img.resize((w, h), Image.LANCZOS)
    if item["kind"] == "wall" and not item.get("spots"):
        pic.putalpha(ImageChops.multiply(pic.getchannel("A"), r.round_mask(w, h, round(w * 0.03))))
    pad = 44
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shade = Image.new("L", out.size, 0)
    shade.paste(pic.getchannel("A").point(lambda v: round(v * 0.38)), (pad, pad + 14))
    black = Image.new("RGBA", out.size, (0, 0, 0, 0))
    black.putalpha(shade.filter(ImageFilter.GaussianBlur(16)))
    out.alpha_composite(black)
    out.alpha_composite(pic, (pad, pad))
    return out

def picture(url):
    return Image.open(io.BytesIO(r.get(url, raw=True))).convert("RGBA")

def wall_parts(p):
    """A wall's real posters and saved spots, or nothing if they can't all be read."""
    tags = p.get("tags") or []
    spots = [[float(v) for v in spot.split(",")] for spot in (r.tag_value(tags, "spots") or "").split(";") if spot]
    rows = r.get(f"{r.URL}/rest/v1/products?id=in.({','.join(p['pack_items'])})&select=id,display_url,image_url")
    by_id = {row["id"]: row for row in rows}
    if len(spots) < len(p["pack_items"]) or any(pid not in by_id for pid in p["pack_items"]):
        return None
    posters = [picture(by_id[pid]["display_url"] or by_id[pid]["image_url"]) for pid in p["pack_items"]]
    return dict(spots=spots[: len(posters)], posters=posters, paint=r.tag_value(tags, "paint"))

def formation(parts, long_side=1300):
    """The wall's own arrangement of real posters, on nothing, so it sits on any backdrop."""
    spots = parts["spots"]
    left, top = min(s[0] for s in spots), min(s[1] for s in spots)
    width, height = max(s[0] + s[2] for s in spots) - left, max(s[1] + s[3] for s in spots) - top
    k = long_side / max(width, height)
    out = Image.new("RGBA", (round(width * k), round(height * k)), (0, 0, 0, 0))
    for (x, y, w, h), img in zip(spots, parts["posters"]):
        tile = img.resize((round(w * k), round(h * k)), Image.LANCZOS)
        tile.putalpha(ImageChops.multiply(tile.getchannel("A"), r.round_mask(tile.width, tile.height, r.corner(tile.width))))
        out.alpha_composite(tile, (round((x - left) * k), round((y - top) * k)))
    return out

def load(slugs, prices):
    rows = r.get(f"{r.URL}/rest/v1/products?slug=in.({','.join(slugs)})&select=slug,name,price,compare_at_price,image_url,display_url,pack_items,pack_sizes,tags,sizes")
    by_slug = {p["slug"]: p for p in rows}
    missing = [s for s in slugs if s not in by_slug]
    if missing:
        raise SystemExit(f"not in the shop: {', '.join(missing)}")
    items = []
    for slug in slugs:
        p = by_slug[slug]
        parts = wall_parts(p) if p["pack_items"] else None
        src = formation(parts) if parts else picture(p["display_url"] or p["image_url"])
        name = short_name(p["name"])
        price, was, several = price_of(p)
        tint = tint_of(src)
        item = dict(slug=slug, name=name, kind=kind_of(p), price=price, was=was, several=several, src=src, tint=tint, **(parts or {}))
        item["hero"] = fitted(item, 800, 900)
        item["name_layer"] = r.text_layer(name, r.fit_font(lambda z: r.rounded_font(z, 800), name, W - 140, 66), INK)
        item["name_dark"] = r.text_layer(name, r.fit_font(lambda z: r.rounded_font(z, 800), name, W - 140, 66), WHITE)
        item["name_big"] = r.text_layer(name.upper(), r.fit_font(DISPLAY, name.upper(), W - 90, 118), WHITE, stroke=8, stroke_fill=INK)
        item["tag"] = price_tag(item) if prices else None
        items.append(item)
    return items

def price_tag(item):
    text = ("From " if item["several"] else "") + r.inr(item["price"]) + (f" · {saving(item)}% off" if saving(item) else "")
    return r.pill(text, r.rounded_font(54, 800), YELLOW, INK, padx=36, pady=18)

class Beats:
    """When each product is on: its --times seconds, or the style's automatic length."""
    def __init__(self, count, auto, times=None):
        chosen = TIMES if times is None else times
        self.lens = [chosen[k] if k < len(chosen) and chosen[k] else auto for k in range(count)]
        self.starts = [sum(self.lens[:k]) for k in range(count)]
        self.total = sum(self.lens)
    def at(self, t):
        """Which product is on at t, and for how long it has been."""
        i = len(self.starts) - 1
        while i > 0 and t < self.starts[i]:
            i -= 1
        return i, t - self.starts[i]

# ---------- backdrops and moves ----------
def wash(tint):
    """A soft backdrop in the product's colour, lighter behind it, with the shop's dots."""
    top, low = mix(tint, WHITE, 0.62), mix(tint, WHITE, 0.32)
    bg = Image.composite(Image.new("RGB", (W, H), low), Image.new("RGB", (W, H), top), Image.linear_gradient("L").resize((W, H)))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 520, 280, W / 2 + 520, 1300], fill=170)
    bg = Image.composite(Image.new("RGB", (W, H), WHITE), bg, glow.filter(ImageFilter.GaussianBlur(140)))
    d = ImageDraw.Draw(bg, "RGBA")
    for y in range(18, H, 54):
        for x in range(18, W, 54):
            d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255, 90))
    return bg

def stage(tint):
    """A dark stage with a pool of the product's colour."""
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 560, 300, W / 2 + 560, 1400], fill=150)
    return Image.composite(Image.new("RGB", (W, H), mix(tint, (0, 0, 0), 0.25)), Image.new("RGB", (W, H), (17, 17, 19)), glow.filter(ImageFilter.GaussianBlur(190)))

def crossfade(backs, i, u):
    """Backdrop i, fading in from i - 1 while u goes 0 → 1."""
    if i == 0 or u >= 1:
        return backs[i].copy()
    return Image.blend(backs[i - 1], backs[i], ease_in_out(clamp(u)))

def iris(old, new, p, cx=W / 2, cy=H / 2):
    """new opens out of old in a growing circle."""
    if p <= 0:
        return old
    if p >= 1:
        return new
    rad = math.hypot(W, H) * ease_in_out(p)
    mask = Image.new("L", (W // 4, H // 4), 0)
    ImageDraw.Draw(mask).ellipse([(cx - rad) / 4, (cy - rad) / 4, (cx + rad) / 4, (cy + rad) / 4], fill=255)
    return Image.composite(new, old, mask.resize((W, H), Image.BILINEAR))

def show_text(frame, item, u, dark=False, y=1395):
    """Name and price popping in under the product (u: seconds since it arrived)."""
    r.pop(frame, item["name_dark" if dark else "name_layer"], W / 2, y, u / 0.35)
    if item["tag"]:
        r.pop(frame, item["tag"], W / 2, y + 96, (u - 0.1) / 0.35)

def counter(frame, i, n):
    tag = r.pill(f"{i + 1} / {n}", r.rounded_font(38, 800), INK, WHITE, padx=26, pady=12)
    frame.alpha_composite(tag, ((W - tag.width) // 2, 215))

# ---------- styles: each returns (seconds, draw(t) → frame) ----------
def spotlight(items, hook):
    n = len(items)
    backs = [wash(i["tint"]) for i in items]
    beats = Beats(n, max(0.95, min(1.7, 13 / n)))
    cy = 800
    def draw(t):
        i, on = beats.at(t)
        frame = crossfade(backs, i, on / 0.35).convert("RGBA")
        for k in (i - 1, i):
            if k < 0:
                continue
            side = 1 if k % 2 else -1
            came, left = clamp((t - beats.starts[k]) / 0.5), clamp((t - beats.starts[k + 1]) / 0.32) if k < n - 1 else 0
            x = W / 2 + side * 1000 * (1 - ease_out_back(came, 1.1)) - side * 1100 * left ** 2
            rot = side * 16 * (1 - ease_out(came)) + side * 12 * left
            float_y = math.sin((t - beats.starts[k]) * 2.6) * 10
            r.draw_tile(frame, dict(tile=items[k]["hero"]), x, cy + float_y, scale=0.86 + 0.14 * ease_out_back(came, 1.4) + 0.012 * (t - beats.starts[k]), rot=rot)
        show_text(frame, items[i], on - 0.2)
        counter(frame, i, n)
        return frame
    return beats.total, draw

def spots(n, rnd):
    """Scattered cells across the screen, tallest area clear of Instagram's top and caption."""
    cols = 2 if n <= 4 else 3 if n <= 9 else 4
    rows = math.ceil(n / cols)
    cw, ch = (W - 90) / cols, 1200 / rows
    out = []
    for i in range(n):
        row, col = divmod(i, cols)
        in_row = min(cols, n - row * cols)
        x = 45 + cw * (col + (cols - in_row) / 2 + 0.5) + rnd.uniform(-0.06, 0.06) * cw
        y = 255 + ch * (row + 0.5) + rnd.uniform(-0.06, 0.06) * ch
        out.append((x, y, rnd.uniform(-11, 11)))
    rnd.shuffle(out)
    return out, cw, ch

def slap(items, hook):
    n = len(items)
    rnd = random.Random(items[0]["slug"])
    places, cw, ch = spots(n, rnd)
    pics = [fitted(i, cw * 1.08, ch * 1.08) for i in items]
    bg = r.background().convert("RGBA")
    beats = Beats(n, max(0.42, min(0.8, 8 / n)))
    fall = 0.2
    bursts = [[(rnd.uniform(0, math.tau), rnd.uniform(160, 330)) for _ in range(12)] for _ in items]
    board = bg.copy()
    laid = [0]
    def draw(t):
        # posters that have settled go on the board for good
        while laid[0] < n and t >= beats.starts[laid[0]] + fall + 0.16:
            k = laid[0]
            r.draw_tile(board, dict(tile=pics[k]), places[k][0], places[k][1], rot=places[k][2])
            laid[0] += 1
        frame = board.copy()
        shake = 0
        for k in range(laid[0], n):
            u = t - beats.starts[k]
            if u <= 0:
                break
            x, y, rot = places[k]
            if u < fall:  # comes down at the screen, speeding up
                p = u / fall
                r.draw_tile(frame, dict(tile=pics[k]), x, y, scale=3.1 - 2.2 * p * p, rot=rot + 18 * (1 - p), alpha=clamp(p * 3))
            else:  # lands, squashes, settles
                u -= fall
                r.draw_tile(frame, dict(tile=pics[k]), x, y, scale=0.9 + 0.1 * ease_out_back(clamp(u / 0.16), 2.4), rot=rot)
        k, on = beats.at(t)
        if 0 <= on - fall < 0.5:
            u = on - fall
            x, y = places[k][:2]
            d = ImageDraw.Draw(frame, "RGBA")
            ring = 90 + 520 * ease_out(clamp(u / 0.4))
            d.ellipse([x - ring, y - ring, x + ring, y + ring], outline=items[k]["tint"] + (round(190 * (1 - clamp(u / 0.4))),), width=10)
            for ang, dist in bursts[k]:
                f = ease_out(clamp(u / 0.45))
                px, py = x + math.cos(ang) * dist * f, y + math.sin(ang) * dist * f
                size = 13 * (1 - clamp(u / 0.5))
                d.ellipse([px - size, py - size, px + size, py + size], fill=mix(items[k]["tint"], YELLOW, (ang % 1) * 0.6) + (255,))
            shake = 16 * (1 - clamp(u / 0.22))
        k, on = beats.at(max(0, t - fall))
        show_text(frame, items[k], on, y=1465)
        if shake:
            frame = ImageChops.offset(frame, round(math.sin(t * 90) * shake), round(math.cos(t * 75) * shake))
        return frame
    return beats.total + 0.5, draw

def carousel(items, hook):
    n = len(items)
    backs = [stage(i["tint"]) for i in items]
    beats = Beats(n, max(1.0, min(1.6, 12 / n)))
    turn = 0.55
    cy = 800
    def centre(t):
        i, on = beats.at(t)
        return i + ease_in_out(clamp((on - beats.lens[i] + turn) / turn)) if i < n - 1 else i
    def draw(t):
        c = centre(t)
        i = round(c)
        frame = crossfade(backs, min(n - 1, int(c) + 1), c - int(c)).convert("RGBA")
        near = sorted(range(n), key=lambda k: -abs(k - c))
        for k in near:
            off = k - c
            if abs(off) > 2.3:
                continue
            x = W / 2 + math.sin(off * 1.05) * 560
            scale = 1 - 0.3 * min(1.6, abs(off))
            ang = 52 * max(-1, min(1, off))
            img = items[k]["hero"]
            hw, hh = img.width / 2 * scale, img.height / 2 * scale
            corners = [r.turned(px, py, ang, 0, 1500) for px, py in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
            r.warp(frame, img, [(x + px, cy + py) for px, py in corners])
        if abs(c - i) < 0.25:
            show_text(frame, items[i], t - beats.starts[i] - (turn * 0.3 if i else 0), dark=True)
        counter(frame, i, n)
        return frame
    return beats.total - turn * 0.3, draw

def shop_card(item, prices):
    """A product card like the shop's: picture on white, name, price."""
    cw, ch = 860, 1170
    pad = 44
    card = Image.new("RGBA", (cw + pad * 2, ch + pad * 2), (0, 0, 0, 0))
    glow = Image.new("L", card.size, 0)
    ImageDraw.Draw(glow).rounded_rectangle([pad, pad + 14, pad + cw, pad + ch + 14], 56, fill=90)
    card.putalpha(glow.filter(ImageFilter.GaussianBlur(20)))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([pad, pad, pad + cw, pad + ch], 56, fill=mix(item["tint"], WHITE, 0.86))
    d.rounded_rectangle([pad + 26, pad + 26, pad + cw - 26, pad + 900], 38, fill=WHITE)
    pic = fitted(item, 730, 800)
    card.alpha_composite(pic, ((card.width - pic.width) // 2, pad + 464 - pic.height // 2))
    d = ImageDraw.Draw(card)
    d.text((pad + 44, pad + 926), {"sticker": "Sticker", "poster": "Wall poster", "wall": "Wall set"}[item["kind"]], font=r.rounded_font(36, 600), fill=MUTED)
    d.text((pad + 44, pad + 976), item["name"], font=r.fit_font(lambda z: r.rounded_font(z, 800), item["name"], cw - 88, 62), fill=INK)
    if prices:
        d.text((pad + 44, pad + 1054), ("From " if item["several"] else "") + r.inr(item["price"]), font=r.rounded_font(68, 900), fill=ORANGE)
    return card

def swipe(items, hook):
    n = len(items)
    cards = [shop_card(i, True) for i in items]
    if not items[0]["tag"]:
        cards = [shop_card(i, False) for i in items]
    backs = [wash(i["tint"]) for i in items]
    beats = Beats(n, max(0.95, min(1.5, 12 / n)))
    fly = 0.42
    cy = 820
    def draw(t):
        i, u = beats.at(t)
        going = clamp((u - (beats.lens[i] - fly)) / fly) if i < n - 1 else 0
        frame = crossfade(backs, min(n - 1, i + 1), going).convert("RGBA") if going else backs[i].convert("RGBA")
        for k in range(min(n - 1, i + 2), i, -1):  # the deck behind, rising as the top card goes
            depth = k - i - ease_out(going)
            r.draw_tile(frame, dict(tile=cards[k]), W / 2, cy + 46 * depth, scale=1 - 0.05 * depth)
        side = -1 if i % 2 else 1
        p = going * going
        r.draw_tile(frame, dict(tile=cards[i]), W / 2 + side * 1250 * p, cy - 120 * p, rot=-side * 24 * p)
        counter(frame, i, n)
        return frame
    return beats.total, draw

def beat(items, hook):
    n = len(items)
    colors = [ORANGE, YELLOW, (40, 120, 200), INK, (18, 161, 80), (225, 45, 120)]
    beats = Beats(n, max(0.48, min(0.72, 8 / n)))
    def draw(t):
        i, u = beats.at(t)
        col = colors[i % len(colors)]
        frame = Image.new("RGBA", (W, H), col + (255,))
        d = ImageDraw.Draw(frame, "RGBA")
        spin = t * 26
        for ang in range(0, 360, 30):  # sun rays behind the product
            a0, a1 = math.radians(ang + spin), math.radians(ang + spin + 13)
            d.polygon([(W / 2, 840), (W / 2 + 1500 * math.cos(a0), 840 + 1500 * math.sin(a0)), (W / 2 + 1500 * math.cos(a1), 840 + 1500 * math.sin(a1))], fill=(255, 255, 255, 26))
        punch = 1.28 - 0.28 * ease_out_long(clamp(u / 0.22))
        r.draw_tile(frame, dict(tile=items[i]["hero"]), W / 2, 800, scale=punch, rot=-3 if i % 2 else 3)
        frame.alpha_composite(items[i]["name_big"], ((W - items[i]["name_big"].width) // 2, 1340))
        if items[i]["tag"]:
            frame.alpha_composite(items[i]["tag"], ((W - items[i]["tag"].width) // 2, 1475))
        if u < 0.07:
            frame.alpha_composite(Image.new("RGBA", (W, H), (255, 255, 255, round(190 * (1 - u / 0.07)))))
        return frame
    return beats.total, draw

def scroll(items, hook):
    n = len(items)
    tw, gap = 330, 26
    # three long strips of all the products, each starting somewhere else
    strips = []
    for c in range(3):
        order = [items[(c * 2 + k) % n] for k in range(max(n, 7))]
        tiles = [fitted(i, tw, tw * 1.3) for i in order]
        height = sum(t.height + gap for t in tiles)
        strip = Image.new("RGBA", (tw + 88, height * 2), (0, 0, 0, 0))
        y = 0
        for _ in range(2):
            for tile in tiles:
                strip.alpha_composite(tile, ((strip.width - tile.width) // 2, y))
                y += tile.height + gap
        strips.append((strip, height))
    board_w, board_h = 3 * (tw + 40) + 60, 2500
    bg = stage(ORANGE).convert("RGBA")
    secs = Beats(n, max(6.0, min(10.0, n * 0.9)) / n).total
    title = r.text_layer(hook.upper(), r.fit_font(DISPLAY, hook.upper(), W - 120, 118), WHITE, stroke=10, stroke_fill=INK)
    def draw(t):
        frame = bg.copy()
        board = Image.new("RGBA", (board_w, board_h), (0, 0, 0, 0))
        moved = 170 * t + 90 * ease_in_out(clamp(t / 2))
        for c, (strip, height) in enumerate(strips):
            off = (moved * (1 if c % 2 else 1.2)) % height
            top = -round(off) if c % 2 else -round(height - off)
            board.alpha_composite(strip.crop((0, -top, strip.width, min(strip.height, -top + board_h))), (30 + c * (tw + 40), 0))
        tilt = 7
        cos, sin = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
        hw, hh = board_w / 2 * 0.98, board_h / 2 * 0.98
        quad = []
        for px, py in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)):
            x, y = r.turned(px, py, -14, 10, 2600)
            quad.append((W / 2 + x * cos - y * sin, H / 2 + x * sin + y * cos))
        r.warp(frame, board, quad)
        r.pop(frame, title, W / 2, 300, t / 0.4)
        return frame
    return secs, draw

def walltour(items, hook):
    """Wall after wall: each one's real posters go up one by one on its own paint."""
    n = len(items)
    backs = [(r.paint_bg(i["paint"]) if i.get("paint") else wash(i["tint"])).convert("RGBA") for i in items]
    box_w, box_h, box_top = 900, 1000, 250
    sets = []
    for item in items:
        if not item.get("spots"):
            sets.append([(item["hero"], W / 2, 750)])
            continue
        spots = item["spots"]
        left, top = min(s[0] for s in spots), min(s[1] for s in spots)
        width, height = max(s[0] + s[2] for s in spots) - left, max(s[1] + s[3] for s in spots) - top
        k = min(box_w / width, box_h / height)
        ox, oy = (W - width * k) / 2, box_top + (box_h - height * k) / 2
        sets.append([(r.poster_tile(img, round(s[2] * k), round(s[3] * k))[0], ox + (s[0] - left + s[2] / 2) * k, oy + (s[1] - top + s[3] / 2) * k) for s, img in zip(spots, item["posters"])])
    beats = Beats(n, max(1.9, min(2.8, 16 / n)))
    def wall_at(i, t):
        """Wall i, t seconds after it started."""
        frame = backs[i].copy()
        gap = min(0.14, 1.1 / len(sets[i]))
        for k, (tile, x, y) in enumerate(sets[i]):
            p = clamp((t - k * gap) / 0.35)
            if p > 0:
                r.draw_tile(frame, dict(tile=tile), x, y - 46 * (1 - ease_out(p)), scale=1.14 - 0.14 * ease_out_back(p, 1.4), rot=(5 if k % 2 else -5) * (1 - ease_out(p)), alpha=clamp(p * 3))
        show_text(frame, items[i], t - min(1.0, gap * len(sets[i])), y=1320)
        return frame
    def draw(t):
        i, u = beats.at(t)
        frame = wall_at(i, u)
        if i < n - 1 and u > beats.lens[i] - IRIS:
            frame = iris(frame, wall_at(i + 1, 0), (u - beats.lens[i] + IRIS) / IRIS)
        counter(frame, i, n)
        return frame
    return beats.total, draw

# ---------- UGC templates ----------
def caption_box(text, size=50, width=900):
    """White rounded caption boxes, one per line, like text typed on a phone video."""
    f = r.rounded_font(size, 700)
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if f.getlength(trial) > width and line:
            lines.append(line)
            line = word
        else:
            line = trial
    lines.append(line)
    pad, gap = 26, size + 30
    out = Image.new("RGBA", (W, gap * len(lines) + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for i, l in enumerate(lines):
        lw = f.getlength(l)
        d.rounded_rectangle([(W - lw) / 2 - pad, i * gap, (W + lw) / 2 + pad, i * gap + size + 26], 16, fill=WHITE)
        d.text((W / 2, i * gap + (size + 26) / 2), l, font=f, fill=INK, anchor="mm")
    return out.crop(out.getbbox())

def surface(tint):
    """A plain surface shot on a phone: soft side light, a little vignette and sensor grain."""
    base = mix(mix(tint, (236, 228, 218), 0.72), WHITE, 0.15)
    bg = Image.new("RGB", (W, H), base)
    light = Image.new("L", (W, H), 0)
    ImageDraw.Draw(light).ellipse([-260, 120, 980, 1500], fill=120)
    bg = Image.composite(Image.new("RGB", (W, H), WHITE), bg, light.filter(ImageFilter.GaussianBlur(200)))
    edge = Image.new("L", (W, H), 90)
    ImageDraw.Draw(edge).ellipse([-200, -100, W + 200, H + 100], fill=0)
    bg = Image.composite(Image.new("RGB", (W, H), mix(base, (0, 0, 0), 0.45)), bg, edge.filter(ImageFilter.GaussianBlur(170)))
    return ImageChops.soft_light(bg, Image.merge("RGB", [Image.effect_noise((W, H), 10)] * 3))

def handheld(frame, t, zoom=1.04):
    """A hand holding the phone: a slow drift and a slight turn, zoomed in just enough to hide the edges."""
    a = math.radians(0.5 * math.sin(t * 1.3) + 0.25 * math.sin(t * 3.1))
    dx, dy = 9 * math.sin(t * 1.7) + 4 * math.sin(t * 4.3), 11 * math.sin(t * 1.1 + 1) + 4 * math.sin(t * 3.7)
    k = 1 / zoom
    c, s = math.cos(a) * k, math.sin(a) * k
    return frame.transform((W, H), Image.AFFINE, (c, -s, W / 2 - c * W / 2 + s * H / 2 + dx, s, c, H / 2 - s * W / 2 - c * H / 2 + dy), Image.BILINEAR)

def pov(items, hook):
    n = len(items)
    backs = [surface(i["tint"]).convert("RGBA") for i in items]
    beats = Beats(n, max(1.0, min(1.5, 12 / n)))
    hook_box = caption_box(hook, 58)
    boxes = [caption_box(i["name"]) for i in items]
    def draw(t):
        i, u = beats.at(t)
        frame = backs[i].copy()
        # a jump cut in on every other product, then a slow creep forward
        r.draw_tile(frame, dict(tile=items[i]["hero"]), W / 2 + (-34 if i % 2 else 28), 830, scale=(1.14 if i % 2 else 1.0) + 0.05 * u, rot=-2 if i % 2 else 2)
        frame = handheld(frame, t).convert("RGBA")
        frame.alpha_composite(hook_box, ((W - hook_box.width) // 2, 250))
        frame.alpha_composite(boxes[i], ((W - boxes[i].width) // 2, 1370))
        if items[i]["tag"]:
            frame.alpha_composite(items[i]["tag"], ((W - items[i]["tag"].width) // 2, 1370 + boxes[i].height + 16))
        return frame
    return beats.total, draw

def picks(items, hook):
    n = len(items)
    backs = [surface(i["tint"]).convert("RGBA") for i in items]
    beats = Beats(n, max(1.1, min(1.7, 13 / n)))
    hook_box = caption_box(hook, 58)
    show = 4
    def row(k):
        price = f"  {r.inr(items[k]['price'])}" if items[k]["tag"] else ""
        return caption_box(f"{k + 1}. {items[k]['name']}{price}", 40, 960)
    rows = [row(k) for k in range(n)]
    def draw(t):
        i, u = beats.at(t)
        frame = backs[i].copy()
        r.draw_tile(frame, dict(tile=items[i]["hero"]), W / 2, 700, scale=0.78 * (0.9 + 0.1 * ease_out_back(clamp(u / 0.3), 2)) + 0.03 * u)
        frame = handheld(frame, t).convert("RGBA")
        frame.alpha_composite(hook_box, ((W - hook_box.width) // 2, 245))
        y = 1200
        for k in range(max(0, i - show + 1), i + 1):
            r.pop(frame, rows[k], W / 2, y + rows[k].height / 2, (u if k == i else 9) / 0.3)
            y += rows[k].height + 14
        return frame
    return beats.total, draw

def parcel(items, hook):
    n = len(items)
    bg = surface((196, 160, 120)).convert("RGBA")
    beats = Beats(n, max(1.15, min(1.7, 13 / n)))
    t0 = 1.0
    hook_box = caption_box(hook, 58)
    boxes = [caption_box(i["name"]) for i in items]
    BOX, DARK, EDGE = (201, 158, 109), (168, 126, 82), (138, 100, 62)
    x0, x1, y0, y1 = 150, 930, 1130, 1600
    logo = Image.open(os.path.join(r.ROOT, "apps/web/public/icons/icon-192.png")).convert("RGBA").resize((130, 130), Image.LANCZOS)
    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(front)
    d.rectangle([x0, y0, x1, y1], fill=BOX, outline=EDGE, width=4)
    d.rectangle([W / 2 - 46, y0, W / 2 + 46, y0 + 130], fill=(226, 196, 150))
    front.alpha_composite(logo, (W // 2 - 65, y0 + 322))
    def flaps(frame, p):
        """The two top flaps swing up and out from shut."""
        d = ImageDraw.Draw(frame)
        ang = math.radians(142 * ease_in_out(p))
        reach = 390
        for hinge, side in ((x0, 1), (x1, -1)):
            tip = hinge + side * reach * math.cos(ang)
            d.polygon([(hinge, y0), (tip, y0 - 240 * math.sin(ang) - 8), (tip + side * 26, y0 - 200 * math.sin(ang) + 2), (hinge, y0 + 2)], fill=DARK if p > 0.5 else BOX, outline=EDGE)
    def draw(t):
        frame = bg.copy()
        d = ImageDraw.Draw(frame)
        p = clamp((t - 0.25) / 0.6)
        d.rectangle([x0, y0 - 16, x1, y0 + 30], fill=(92, 66, 42))
        i, u = beats.at(max(0, t - t0))
        if t >= t0:
            up = ease_out_back(clamp(u / 0.5), 1.2)
            out = clamp((u - (beats.lens[i] - 0.3)) / 0.3) if i < n - 1 else 0
            r.draw_tile(frame, dict(tile=items[i]["hero"]), W / 2, 1500 + (680 - 1500) * up - 900 * out * out, scale=0.62 + 0.3 * up, rot=(-5 if i % 2 else 5) * (1 - up))
        frame.alpha_composite(front)
        flaps(frame, p)
        frame = handheld(frame, t).convert("RGBA")
        frame.alpha_composite(hook_box, ((W - hook_box.width) // 2, 245))
        if t >= t0 + 0.2:
            frame.alpha_composite(boxes[i], ((W - boxes[i].width) // 2, 1200))
            if items[i]["tag"]:
                frame.alpha_composite(items[i]["tag"], ((W - items[i]["tag"].width) // 2, 1200 + boxes[i].height + 12))
        return frame
    return t0 + beats.total, draw

def thisorthat(items, hook):
    pairs = [(items[k], items[(k + 1) % len(items)]) for k in range(0, len(items), 2)]
    n = len(pairs)
    # a pair stays up as long as its two products' times together
    paired = [(TIMES[k] if k < len(TIMES) and TIMES[k] else 0) + (TIMES[k + 1] if k + 1 < len(TIMES) and TIMES[k + 1] else 0) for k in range(0, len(items), 2)]
    beats = Beats(n, max(1.6, min(2.3, 12 / n)), paired)
    hook_box = caption_box(hook, 52)
    top0, half = 345, 640
    sides = []
    for a, b in pairs:
        sides.append([(fitted(p, 700, half - 120), mix(p["tint"], WHITE, 0.42), caption_box(p["name"], 38)) for p in (a, b)])
    orb = Image.new("RGBA", (170, 170), (0, 0, 0, 0))
    ImageDraw.Draw(orb).ellipse([0, 0, 169, 169], fill=ORANGE, outline=WHITE, width=8)
    ImageDraw.Draw(orb).text((85, 88), "OR", font=DISPLAY(66), fill=WHITE, anchor="mm")
    nums = [r.pill(str(v), r.rounded_font(60, 900), INK, WHITE, padx=30, pady=12) for v in (1, 2)]
    def draw(t):
        i, u = beats.at(t)
        frame = Image.new("RGBA", (W, H), (17, 17, 19, 255))
        d = ImageDraw.Draw(frame)
        for k, (pic, color, name) in enumerate(sides[i]):
            top = top0 + k * half
            side = -1 if k == 0 else 1
            off = side * 1200 * (1 - ease_out_long(clamp((u - k * 0.15) / 0.4)))
            d.rectangle([0, top, W, top + half - 6], fill=color)
            # the name stays clear of the OR between the two
            r.draw_tile(frame, dict(tile=pic), W / 2 + off, top + half / 2 + (34 if k == 0 else -34))
            frame.alpha_composite(name, ((W - name.width) // 2, top + 18 if k == 0 else top + half - name.height - 22))
            frame.alpha_composite(nums[k], (60, top + 30))
        frame = handheld(frame, t).convert("RGBA")
        frame.alpha_composite(hook_box, ((W - hook_box.width) // 2, 245))
        r.pop(frame, orb, W / 2, top0 + half, (u - 0.35) / 0.3)
        return frame
    return beats.total, draw

def wishlist(items, hook):
    n = len(items)
    page = Image.new("RGBA", (W, H), (251, 248, 240, 255))
    d = ImageDraw.Draw(page)
    d.text((70, 215), hook, font=r.fit_font(lambda z: r.rounded_font(z, 800), hook, W - 140, 74), fill=INK)
    d.text((70, 312), "Notes", font=r.rounded_font(34, 500), fill=(190, 140, 20))
    rh = 230
    rows = []
    for i, item in enumerate(items):
        row = Image.new("RGBA", (W - 120, rh - 16), (0, 0, 0, 0))
        rd = ImageDraw.Draw(row)
        rd.rounded_rectangle([0, 0, row.width - 1, row.height - 1], 28, fill=WHITE, outline=(236, 228, 214), width=2)
        pic = fitted(item, 170, 170)
        row.alpha_composite(pic, (108 + (170 - (pic.width - 88)) // 2 - 44, (row.height - pic.height) // 2))
        rd.text((310, 54), item["name"], font=r.fit_font(lambda z: r.rounded_font(z, 700), item["name"], row.width - 340, 46), fill=INK)
        if item["tag"]:
            rd.text((310, 118), ("From " if item["several"] else "") + r.inr(item["price"]), font=r.rounded_font(42, 800), fill=ORANGE)
        rows.append(row)
    beats = Beats(n, max(0.7, min(1.0, 8.5 / n)))
    def draw(t):
        frame = page.copy()
        i, u = beats.at(t)
        # the page moves up once the list passes the bottom of the screen
        fits = 5
        go = i + min(1, u / beats.lens[i]) - (fits - 1)
        shift = rh * ease_in_out(clamp(go - int(go))) + rh * int(go) if go > 0 else 0
        for k in range(i + 1):
            y = 390 + k * rh - shift
            if y > H or y + rh < 170:
                continue
            p = clamp((t - beats.starts[k]) / 0.3)
            frame.alpha_composite(r.faded(rows[k], p), (60 + round(60 * (1 - ease_out(p))), round(y)))
            tick = clamp((t - beats.starts[k] - 0.3) / 0.25)
            cx, cy = 112, y + (rh - 16) / 2
            dr = ImageDraw.Draw(frame)
            dr.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=ORANGE if tick > 0 else WHITE, outline=ORANGE, width=5)
            if tick > 0:
                dr.line([(cx - 13, cy + 1), (cx - 3, cy + 12), (cx + 14, cy - 11)][: 2 if tick < 0.5 else 3], fill=WHITE, width=7)
        frame.paste(page.crop((0, 0, W, 375)), (0, 0))
        return handheld(frame, t).convert("RGBA")
    return beats.total + 0.5, draw

def mini_card(item):
    """A small product card to lay over a video: picture, name, price."""
    cw, ch = 900, 250
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, cw - 1, ch - 1], 36, fill=(255, 255, 255, 240))
    pic = fitted(item, 200, 200)
    card.alpha_composite(pic, (135 - pic.width // 2, ch // 2 - pic.height // 2))
    d.text((270, 64), item["name"], font=r.fit_font(lambda z: r.rounded_font(z, 800), item["name"], cw - 300, 52), fill=INK)
    if item["tag"]:
        d.text((270, 132), ("From " if item["several"] else "") + r.inr(item["price"]), font=r.rounded_font(56, 900), fill=ORANGE)
    return card

def myclip(items, hook):
    """The shop's own video or photo, full screen, with product cards sliding in one after another."""
    if not CLIP:
        raise SystemExit("myclip needs --clip=FILE")
    n = len(items)
    cards = [mini_card(i) for i in items]
    hook_box = caption_box(hook, 58)
    held = tempfile.TemporaryDirectory(prefix="showcase-clip-")
    still = None
    if CLIP.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        img = Image.open(CLIP).convert("RGB")
        k = max(W / img.width, H / img.height)
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
        left, top = (img.width - W) // 2, (img.height - H) // 2
        still = img.crop((left, top, left + W, top + H)).convert("RGBA")
        shots, secs = [], max(6.0, min(12.0, n * 1.5))
    else:
        subprocess.run(["swift", os.path.join(HERE, "decode.swift"), CLIP, held.name, str(FPS), "20"], check=True)
        shots = sorted(os.listdir(held.name))
        if not shots:
            raise SystemExit("could not read that video")
        secs = len(shots) / FPS
    beats = Beats(n, secs / n)
    def draw(t):
        if still:
            frame = handheld(still, t, 1.04 + 0.012 * t).convert("RGBA")
        else:
            frame = Image.open(os.path.join(held.name, shots[round(t * FPS) % len(shots)])).convert("RGBA")  # a short clip loops under longer times
        frame.alpha_composite(hook_box, ((W - hook_box.width) // 2, 245))
        i, u = beats.at(t)
        came, left = ease_out_long(clamp(u / 0.4)), clamp((u - beats.lens[i] + 0.3) / 0.3) if i < n - 1 else 0
        frame.alpha_composite(cards[i], (round(90 + (1 - came) * 1100 - left * left * 1200), 1290))
        return frame
    draw.held = held  # keeps the frames until the reel is made
    return beats.total, draw

STYLE_FN = dict(spotlight=spotlight, slap=slap, carousel=carousel, swipe=swipe, beat=beat, scroll=scroll, walltour=walltour,
                pov=pov, picks=picks, parcel=parcel, thisorthat=thisorthat, wishlist=wishlist, myclip=myclip)

# ---------- start and end ----------
def hook_layer(hook, color):
    """The hook, on two lines when it's long, in the display font (plain rounded type for anything it can't draw)."""
    make = DISPLAY if hook.isascii() else (lambda z: r.rounded_font(z, 900))
    words = hook.split()
    if len(words) > 2 and make(136).getlength(hook) > W - 120:
        half = len(words) // 2
        lines = [" ".join(words[:half]), " ".join(words[half:])]
    else:
        lines = [hook]
    layers = [r.text_layer(l, r.fit_font(make, l, W - 120, 136), color) for l in lines]
    out = Image.new("RGBA", (max(l.width for l in layers), sum(l.height for l in layers) + 16 * (len(layers) - 1)), (0, 0, 0, 0))
    y = 0
    for l in layers:
        out.alpha_composite(l, ((out.width - l.width) // 2, y))
        y += l.height + 16
    return out

def finale(items, hook, prices, offer):
    n = len(items)
    cols = 2 if n <= 4 else 3 if n <= 9 else 4
    rows = math.ceil(n / cols)
    cw, ch = 940 / cols, 730 / rows
    pics = []
    for i, item in enumerate(items):
        row, col = divmod(i, cols)
        in_row = min(cols, n - row * cols)
        pics.append((fitted(item, cw * 0.96, ch * 0.96), 70 + cw * (col + (cols - in_row) / 2 + 0.5), 330 + ch * (row + 0.5), (1 if i % 2 else -1) * 4))
    bg = r.background().convert("RGBA")
    title = hook_layer(hook, INK)
    title = title.resize((min(title.width, 900), round(title.height * min(title.width, 900) / title.width)), Image.LANCZOS)
    if title.height > 130:
        title = title.resize((round(title.width * 130 / title.height), 130), Image.LANCZOS)
    low = min(i["price"] for i in items)
    several = any(i["several"] for i in items) or len({i["price"] for i in items}) > 1
    price = r.text_layer(("From " if several else "") + r.inr(low), r.rounded_font(112, 900), ORANGE) if prices else None
    best = max(saving(i) for i in items)
    save = r.pill(f"SAVE UP TO {best}%", r.HEAD(44), ORANGE, WHITE, padx=30, pady=14) if prices and best else None
    cta = r.pill("Order at stickypie.in", r.HEAD(58), YELLOW, INK, padx=50, pady=28)
    line = offer or "Link in bio · Ships across India"
    sub_line = r.text_layer(line, r.fit_font(lambda z: r.rounded_font(z, 700), line, W - 140, 44), INK)
    brand = r.assets(dict(posters=[], paint=None, title="x", sizes=[], feet=None, price=0, compare=None))["brand"]
    def draw(t):
        frame = bg.copy()
        r.pop(frame, title, W / 2, 235, t / 0.4)
        for i, (pic, x, y, rot) in enumerate(pics):
            p = clamp((t - 0.1 - i * min(0.07, 0.8 / n)) / 0.5)
            if p > 0:
                r.draw_tile(frame, dict(tile=pic), x, y + 90 * (1 - ease_out(p)), scale=0.7 + 0.3 * ease_out_back(p, 1.5), rot=rot, alpha=clamp(p * 2.5))
        if price:
            r.pop(frame, price, W / 2, 1140, (t - 0.8) / 0.4)
        if save:
            r.pop(frame, save, W / 2, 1245, (t - 0.95) / 0.4)
        r.pop(frame, cta, W / 2, 1355, (t - 1.1) / 0.4)
        r.pop(frame, sub_line, W / 2, 1450, (t - 1.25) / 0.4)
        r.pop(frame, brand, W / 2, 1535, (t - 1.4) / 0.4)
        return frame
    return draw

def what_it_is(items):
    kinds = {i["kind"] for i in items}
    words = [w for k, w in (("sticker", "die-cut vinyl stickers"), ("poster", "wall posters"), ("wall", "wall sets")) if k in kinds]
    return ", ".join(words[:-1]) + (" and " if len(words) > 1 else "") + words[-1]

def price_lines(items, prices):
    lines = [f"{i['name']}" + (f": {'from ' if i['several'] else ''}{r.inr(i['price'])}" if prices else "") for i in items[:6]]
    return lines + ([f"+ {len(items) - 6} more"] if len(items) > 6 else [])

def deal_line(items):
    best = max(saving(i) for i in items)
    return f"From {r.inr(min(i['price'] for i in items))}" + (f", save up to {best}%." if best else ".")

def hash_tags(items):
    kinds = {i["kind"] for i in items}
    tags = ["stickypie", "shoponlineindia"]
    if "sticker" in kinds:
        tags = ["stickers", "vinylstickers", "laptopstickers", "bikestickers"] + tags
    if kinds & {"poster", "wall"}:
        tags = ["wallposters", "posterwall", "roomdecor", "walldecor", "homedecorindia"] + tags
    return tags

def caption(items, hook, prices, offer):
    """Instagram: leads with the deal and ends on how to order."""
    return "\n".join([
        hook[0].upper() + hook[1:] + " ✨",
        "",
        *([deal_line(items), ""] if prices else []),
        *price_lines(items, prices),
        "",
        f"Pick your favourite {what_it_is(items)}.",
        *([offer] if offer else []),
        "Order at stickypie.in (link in bio). Ships across India 🇮🇳",
        "",
        " ".join("#" + t for t in hash_tags(items)),
    ]) + "\n"

def shorts_text(items, hook, prices, offer):
    """YouTube Shorts: a title (100 characters at most) and a description with the shop's address."""
    title = hook[0].upper() + hook[1:]
    title = title[:92].rstrip() + " #Shorts"
    return "\n".join([
        "TITLE",
        title,
        "",
        "DESCRIPTION",
        *([deal_line(items)] if prices else []),
        *price_lines(items, prices),
        "",
        f"Pick your favourite {what_it_is(items)}.",
        *([offer] if offer else []),
        "Order: https://stickypie.in",
        "Ships across India.",
        "",
        " ".join("#" + t for t in ["shorts"] + hash_tags(items)[:5]),
    ]) + "\n"

def render(items, style, hook, prices, frames_dir, offer="", intro=None, end=None):
    ugc = style in UGC_HOOKS
    intro = 0 if ugc else INTRO if intro is None else intro  # a phone video starts straight in, no title plate
    end = FINALE if end is None else end
    plate = Image.new("RGBA", (W, H), ORANGE + (255,))
    words = hook_layer(hook.upper(), WHITE)
    body_secs, body = STYLE_FN[style](items, hook)
    ending = finale(items, hook.upper(), prices, offer)
    total = intro + body_secs + end
    t_end = intro + body_secs
    nframes = round(total * FPS)
    cover = None
    for fi in range(nframes):
        t = fi / FPS
        if t < intro:
            frame = plate.copy()
            r.pop(frame, words, W / 2, H / 2 - 60, t / 0.4)
            if t > intro - min(IRIS, intro / 2):
                frame = iris(frame, body(0).convert("RGBA"), (t - intro + min(IRIS, intro / 2)) / min(IRIS, intro / 2))
        elif t < t_end:
            frame = body(t - intro)
            if t > t_end - IRIS:
                frame = iris(frame, ending(0), (t - t_end + IRIS) / IRIS)
        else:
            frame = ending(t - t_end)
        frame.convert("RGB").save(os.path.join(frames_dir, f"frame-{fi:05d}.jpg"), quality=93)
        if fi == nframes - 8:
            cover = frame.convert("RGB")
    return nframes, cover

def make(slugs, style, hook, prices, name, offer, intro=None, end=None):
    items = load(slugs, prices)
    low = r.inr(min(i["price"] for i in items))
    hook = (hook or UGC_HOOKS.get(style) or HOOKS.get(style, HOOK)).format(n=len(items), low=low)
    os.makedirs(OUT, exist_ok=True)
    frames_dir = tempfile.mkdtemp(prefix="showcase-")
    try:
        nframes, cover = render(items, style, hook, prices, frames_dir, offer, intro, end)
        out = os.path.join(OUT, f"{name}.mp4")
        subprocess.run(["swift", os.path.join(HERE, "encode.swift"), frames_dir, out, str(FPS)], check=True)
        cover.save(os.path.join(OUT, f"{name}-cover.jpg"), quality=90)
        with open(os.path.join(OUT, f"{name}-caption.txt"), "w") as f:
            f.write(caption(items, hook, prices, offer))
        with open(os.path.join(OUT, f"{name}-shorts.txt"), "w") as f:
            f.write(shorts_text(items, hook, prices, offer))
        with open(os.path.join(OUT, f"{name}-info.json"), "w") as f:
            json.dump(dict(style=style, hook=hook, offer=offer, prices=prices, products=[i["name"] for i in items], slugs=slugs, times=TIMES, intro=intro, end=end, seconds=round(nframes / FPS, 1)), f)
        print(f"  ✔ {len(items)} products ({style}): {out} ({nframes / FPS:.1f} s)")
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)

if __name__ == "__main__":
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = lambda key, default: next((a.split("=", 1)[1] for a in sys.argv if a.startswith(f"--{key}=")), default)
    style, hook, offer = opt("style", "spotlight"), opt("hook", "").strip().replace("{", "").replace("}", ""), opt("offer", "").strip()
    CLIP = opt("clip", None)
    TIMES = [float(v) if v else None for v in opt("times", "").split(",")] if opt("times", "") else []
    intro, end = opt("intro", ""), opt("end", "")
    if style not in STYLES:
        print(f"unknown style {style}; pick one of {', '.join(STYLES)}")
        sys.exit(1)
    if not MIN_ITEMS <= len(slugs) <= MAX_ITEMS:
        print(__doc__)
        sys.exit(1)
    make(slugs, style, hook, "--no-prices" not in sys.argv, opt("name", f"{style}-{time.strftime('%Y%m%d-%H%M%S')}"), offer, float(intro) if intro else None, float(end) if end else None)
