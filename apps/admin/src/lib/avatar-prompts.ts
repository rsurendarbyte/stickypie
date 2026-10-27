/**
 * Prompts for the AI image tool, shown in admin with Copy buttons:
 * - samples (admin → Avatar sheets): each style's card pictures and sample
 *   sheets, one girl and one boy — the same two characters across every style,
 *   so the samples look like one set;
 * - sheets come in sets (Set 1, Set 2…), each with its own nine poses: two
 *   built in per style, and the admin can add, edit or remove sets (saved on
 *   the style as poseSets);
 * - orders: the same sheet made from the customer's attached photo, per style
 *   they picked and per set.
 * Styles without their own entry get a prompt built from their name.
 */

type Look = {
  /** The title sticker at the top. */
  title: string;
  /** What the art looks like. */
  style: string;
  /** The nine poses, when the style needs its own. */
  poses?: string;
  /** The nine poses of the second sheet (Set 2), when the style needs its own. */
  poses2?: string;
  /** Small decorations around each sticker. */
  extras: string;
  /** Extra "not based on" guard for the style. */
  original?: string;
  /** The one sticker on the style card, when the style needs its own. */
  card?: string;
  /** Client photo sheets: the hairstyle and outfit to give the person in this style. */
  restyle?: string;
};

const GIRL =
  "the SAME original young girl character with long wavy brown hair in a half-up bun with a pink bow, a pink knit sweater and blue denim overalls";
const BOY =
  "the SAME original young boy character with messy brown hair, a blue denim jacket over a light grey hoodie and a black backpack";

/** The customer, from the photo attached in the AI tool, and how to keep their likeness. */
const PHOTO = "the person in the attached photo";
/** Keep the face; the hair and clothes change to suit the style (see Look.restyle). */
const LIKENESS =
  "Keep their FACE clearly recognisable in every sticker: the same face shape, skin tone, eye shape and colour, eyebrows, nose, lips and smile, and any glasses, beard, moustache, bindi, moles or dimples they have. Keep their natural hair colour and hair length roughly the same, but do NOT copy the hairstyle or the clothes from the photo: restyle both to suit this sticker style, as described below. If the photo has more than one person, use only the main person in the middle.";

/** For a style with no restyle of its own. */
const RESTYLE_DEFAULT = (label: string) =>
  `a hairstyle and outfit that look typical of the ${label} style, fun and age-appropriate`;

/** Set 2: a second sheet per style, none of Set 1's poses. */
const POSES_2 =
  "jumping with joy, heart hands, taking a selfie with a phone, laughing so hard holding the tummy, surprised with hands on cheeks, eating a slice of pizza, sleepy yawn hugging a pillow, giving a high five, confident salute";

const POSES =
  "peace sign with a wink, big happy laugh with fists up, thumbs up, both hands on cheeks dreamy smile, waving hello, pointing at the viewer with a grin, headphones on with eyes closed, sipping a bubble tea, cool pose with sunglasses";

const LOOKS: Record<string, Look> = {
  "90s Retro": {
    title:
      '"90s RETRO" in bold neon 90s lettering with palm trees and a cassette tape',
    style:
      "1990s retro look: neon pink, purple, teal and yellow colour-block windbreakers, sunset gradient circles with palm trees behind some stickers, bold black outlines, flat bright colours",
    extras:
      "cassette tapes, boomboxes, neon stars, lightning bolts, hearts, music notes",
    restyle:
      "a 90s hairstyle (big volume, scrunchies or a centre part, butterfly clips for girls; curtain hair or a backwards cap for boys) and a neon colour-block windbreaker or oversized graphic tee with high-waist denim",
  },
  Anime: {
    title:
      '"ANIME" in bold brush-stroke lettering with a small crown and stars',
    style:
      "modern Japanese anime illustration: large expressive eyes, clean line art, soft cel shading, glossy hair highlights, vibrant colours",
    extras: "hearts, stars, sparkles, music notes, little exclamation marks",
    original: "any existing anime or manga character",
    restyle:
      "a classic anime hairstyle with glossy spiky or flowing locks in their own hair colour, and a Japanese school-style outfit or trendy streetwear hoodie",
  },
  Chibi: {
    title: '"CHIBI" in puffy rainbow bubble letters with a heart',
    style:
      "cute chibi: big head and tiny body about 2 heads tall, kawaii face with big shiny eyes and blush cheeks, soft pastel colours, full body in every sticker",
    extras: "hearts, stars, sparkles, music notes",
    restyle:
      "a cute oversized chibi hairstyle with a small accessory (bow, clip or cap) and a simple bright kawaii outfit",
  },
  "Comic Book": {
    title: '"COMIC BOOK" in classic comic lettering on a yellow and red burst',
    style:
      "classic American comic book art: bold black ink outlines, halftone dot shading, punchy red, yellow and blue, action lines and star bursts behind each figure",
    poses:
      "peace sign with a wink, big laugh, thumbs up, hands on cheeks surprised, pointing at the viewer, chin on hands smiling, arms crossed confident, fist pump in the air, blowing a kiss",
    poses2:
      "jumping with joy, thinking with a lightbulb idea, running fast with speed lines, laughing holding the tummy, peeking from behind a comic panel, high five, sleepy with a yawn, eating a pizza slice, superhero-style landing",
    extras:
      'comic speech bubbles and sound effects on some stickers: "WOW!", "POW!", "YES!", "OMG!", "ZAP!", plus stars and hearts',
    original: "any existing comic character or superhero",
    card: 'waist-up, giving a big thumbs up with a happy open smile, a "WOW!" comic burst bubble beside the head, halftone and action lines behind',
    restyle:
      "a bold comic-hero hairstyle and a bright casual outfit in primary colours (red jacket, yellow tee, blue jeans)",
  },
  "Action Figure": {
    title:
      '"ACTION FIGURE" in chunky glossy toy-box lettering on a blue star burst',
    style:
      "a collectible action figure toy: glossy moulded plastic look with visible joints, the full-body figure standing inside a toy blister pack with a clear plastic bubble and a bright cardboard backing card; each pack a different bright colour",
    poses:
      "peace sign holding a phone, thumbs up with headphones on, waving with a coffee cup, hand on hip with sunglasses, holding a laptop, holding a skateboard, taking a photo with a camera, flexing with a water bottle, shy smile with a backpack",
    poses2:
      "jumping pose holding a balloon, sitting on a mini sofa with a game controller, holding a guitar, reading a book, walking a small toy puppy, holding a pizza box, chef pose with a spatula, traveller with a mini suitcase, sleeping with a pillow and blanket",
    extras:
      "matching mini accessories in their own moulded trays beside each figure (phone, headphones, bag, sneakers, cap), small stars and hearts printed on the cards",
    original: "any existing toy, doll or brand; no brand names or logos",
    card: "the full-body figure doing a peace sign and holding a phone, inside one toy blister pack with a bright backing card and a few mini accessories in their trays",
    restyle:
      "a neat collectible-figure hairstyle and a trendy outfit made for a toy line (bomber jacket, cargo pants, sneakers)",
  },
  "3D Cartoon": {
    title:
      '"3D CARTOON" in puffy glossy rainbow 3D bubble letters with sparkles',
    style:
      "modern 3D animated movie character render: soft rounded shapes, big expressive eyes, smooth glossy skin, soft studio lighting and gentle shadows, vibrant colours",
    extras: "glossy 3D hearts, stars, sparkles, music notes",
    original: "any existing animated character or studio style",
    restyle:
      "a soft, voluminous animated-movie hairstyle and a cosy colourful outfit (hoodie or cardigan, jeans, sneakers)",
  },
  "Pixel Art": {
    title:
      '"PIXEL ART" in chunky 8-bit rainbow pixel lettering with pixel stars',
    style:
      "16-bit retro video game pixel art: clearly visible square pixels, limited bright palette, crisp hard edges, no blur, no anti-aliasing, no smooth gradients",
    poses:
      "peace sign with a wink, big laugh, thumbs up, hands on cheeks, waving, holding a game controller, headphones on with eyes closed, sipping a bubble tea, jumping with joy",
    poses2:
      "running and jumping like a platform game, holding a sword and shield, collecting a big gold coin, riding a pixel skateboard, sleeping with Zzz, eating pixel pizza, surprised with a question-mark block, waving a victory flag, holding a pixel trophy",
    extras:
      'pixel hearts, gold coins, stars, sparkles, music notes and a "1UP" badge',
    original: "any existing video game character",
    restyle:
      "a simple blocky game-hero hairstyle and a retro gamer outfit (graphic tee, jacket, sneakers)",
  },
  "Clay Toy": {
    title: '"CLAY TOY" in soft rounded plasticine letters in bright colours',
    style:
      "handmade clay / plasticine figure like stop-motion animation: soft matte clay texture, tiny fingerprint marks, rounded chunky shapes, warm soft lighting",
    extras: "clay hearts, stars, little clay flowers and sparkles",
    original: "any existing stop-motion or clay character",
    restyle:
      "a chunky sculpted clay hairstyle and a simple bright knitted outfit",
  },
  "Bollywood Poster": {
    title:
      '"BOLLYWOOD" in bold vintage hand-painted film-poster lettering with a glowing gold edge',
    style:
      "dramatic vintage hand-painted Bollywood movie poster art: rich saturated colours, painterly brush strokes, filmy glamorous poses, glowing rim light, sparkle and lens flare, a coloured sunburst behind each figure",
    poses:
      "filmy hero/heroine pose with arms wide open, peace sign with a wink, dramatic hand on heart, dancing pose, sunglasses swag, laughing, waving to fans, pointing at the viewer, shy smile looking over the shoulder",
    poses2:
      "slow-motion hair flip in the wind, romantic pose with a rose, dramatic tear and smile, angry-young-hero glare with folded arms, sunset silhouette pose, dancing in the rain with an umbrella, autograph signing, holding a film award, laughing in a sparkling spotlight",
    extras:
      'small ribbon banners reading "STARRING ME" on some stickers, stars, sparkles, film reels and roses',
    original: "any real actor or existing film poster",
    card: 'waist-up, a filmy pose with one arm open wide and a confident smile, a coloured sunburst behind and a small "STARRING ME" ribbon below',
    restyle:
      "a glamorous filmy hairstyle (wind-blown hero hair or flowing heroine waves) and a classic Bollywood outfit (leather jacket and aviators, or a flowing chiffon saree or dress)",
  },
  Superhero: {
    title:
      '"SUPERHERO" in bold metallic action lettering on a red and blue burst',
    style:
      "bright superhero comic style: an original costume with a flowing cape, an eye mask and a simple star emblem on the chest, heroic lighting, energy bursts and speed lines; a city skyline behind some stickers",
    poses:
      "hands-on-hips hero stance, flying with one fist forward, peace sign with a wink, thumbs up, flexing arms, landing pose, waving from the sky, laughing, saluting",
    poses2:
      "lifting a big rock, running at super speed, catching a falling star, hugging a rescued kitten, standing on a rooftop at night, shooting a small energy beam, thumbs up while flying, sleepy hero with the cape as a blanket, high five",
    extras: "energy bursts, stars, lightning bolts and small clouds",
    original: "any existing superhero; no existing costumes, emblems or logos",
    card: "waist-up, hands on hips in a proud hero stance with the cape flowing and a confident smile, a small energy burst behind",
    restyle:
      "a heroic windswept hairstyle and an original superhero suit with a cape, eye mask, belt and boots",
  },
  "Pencil Sketch": {
    title:
      '"PENCIL SKETCH" in hand-lettered graphite pencil writing with a small pencil',
    style:
      "hand-drawn graphite pencil sketch on white paper: realistic shading, crosshatching and loose construction lines, black and grey only with one soft pink accent colour on a few details",
    extras: "small hand-drawn doodle hearts, stars and arrows in pencil",
    restyle:
      "a softly sketched natural hairstyle and a simple everyday outfit (sweater or shirt), drawn in pencil",
  },
  "Watercolour Storybook": {
    title:
      '"STORYBOOK" in soft hand-painted watercolour lettering with little flowers',
    style:
      "dreamy children's storybook watercolour painting: soft washes of colour, visible paper texture, gentle ink outlines, warm pastel light, cosy and whimsical",
    extras: "watercolour flowers, leaves, butterflies, little clouds and stars",
    original: "any existing animated film, studio style or storybook character",
    restyle:
      "a dreamy storybook hairstyle with a small flower or ribbon, and a soft vintage storybook outfit (pinafore, cardigan or waistcoat)",
  },
  "Street Graffiti": {
    title:
      '"GRAFFITI" in bold spray-paint street-art lettering with drips and arrows',
    style:
      "urban street-art graffiti: spray-paint textures, paint drips, thick bold outlines, bright neon colours, a brick-wall patch behind some stickers",
    poses:
      "peace sign with a wink, holding a spray-paint can, thumbs up, arms crossed cool, waving, pointing at the viewer, headphones on nodding to music, skateboard under one arm, sunglasses swag",
    poses2:
      "spray-painting a heart on a wall, breakdance freeze pose, sitting on a boombox, peace sign with a cap backwards, laughing with headphones around the neck, jumping with a skateboard trick, holding a paint roller, fist bump, sitting on stairs with a smile",
    extras: "spray-paint splashes, drips, crowns, arrows, stars and hearts",
    original:
      "any existing graffiti artist's work or brand; no brand names or logos",
    restyle:
      "a street-style hairstyle (cap backwards, bandana or messy top knot) and urban streetwear (oversized hoodie, ripped jeans, high-top sneakers)",
  },
  "Desi Festive": {
    title: '"DESI VIBES" in festive gold lettering with marigolds and a diya',
    style:
      "bright Indian festive look: the character in traditional festive wear (kurta or lehenga with gold borders), marigold garlands, glowing diyas, rangoli patterns and warm golden light, joyful and colourful",
    poses:
      "namaste with a smile, peace sign with a wink, holding a sparkler, dancing with arms up, holding a diya, eating a laddoo, taking a selfie, throwing colour powder, shy smile with a dupatta",
    poses2:
      "flying a kite, playing garba with dandiya sticks, lighting a rangoli lamp, eating jalebi, wearing a garland with folded hands, holding a gift box, dancing bhangra, tying a rakhi, holding a plate of sweets",
    extras:
      "marigold flowers, diyas, rangoli dots, sparkles, lanterns and colour-powder puffs",
    card: "waist-up, a happy namaste with a big smile, a glowing diya and marigolds beside them",
    restyle:
      "a festive Indian hairstyle (braid or bun with flowers for girls, neatly styled for boys) and traditional festive wear (lehenga or saree, or kurta with a dupatta or Nehru jacket)",
  },
  "Cricket Star": {
    title:
      '"CRICKET STAR" in bold sporty stadium lettering with a bat and ball',
    style:
      "bright sporty cartoon: the character in a plain coloured cricket jersey and cap (no team names, numbers or logos), a sunny stadium or green pitch behind some stickers, dynamic and fun",
    poses:
      "batting a big shot, raising the bat for a century, bowling with a big leap, diving catch, thumbs up holding a ball, peace sign with a wink, fist pump celebrating, holding a trophy, waving to the crowd",
    poses2:
      "wicket-keeper crouch with gloves, running between the wickets, umpire-style finger up, leaping celebration, signing an autograph on a bat, sitting on the pitch with a water bottle, spinning the ball on a finger, wearing a medal, cheering with a flag",
    extras:
      "cricket balls, stumps, stars, sparkles and little crowd cheer lines",
    original:
      "any real cricketer, team or brand; no team names, numbers or logos",
    card: "waist-up, raising a cricket bat high in celebration with a big smile",
    restyle:
      "a sporty hairstyle under a cricket cap or helmet and a plain coloured cricket jersey and whites with no team names, numbers or logos",
  },
  "Cyberpunk Neon": {
    title: '"CYBERPUNK" in glowing neon sign lettering with a glitch effect',
    style:
      "futuristic cyberpunk: glowing neon pink, cyan and purple rim lights, a techwear jacket with glowing trim, holographic visor or LED glasses on some stickers, a rainy neon city behind some stickers",
    extras:
      "neon lightning, glitch pixels, holographic hearts, stars and circuit lines",
    restyle:
      "a futuristic hairstyle with neon-coloured streaks or an undercut, and a techwear jacket with glowing trim",
  },
  "Plush Toy": {
    title: '"PLUSH TOY" in soft stitched fabric letters with buttons',
    style:
      "a cuddly handmade plush toy version of the character: soft fuzzy felt and fabric textures, visible stitches and seams, button details, rounded squishy shapes, gentle warm lighting",
    extras: "felt hearts, stitched stars, buttons, little clouds and yarn bows",
    restyle: "yarn-like stitched plush hair and a felt outfit with buttons",
  },
  "Big-Head Vinyl Toy": {
    title: '"VINYL TOY" in chunky glossy collectible-toy lettering',
    style:
      "a collectible big-head vinyl figure: oversized square-ish head on a small body, simple solid black dot eyes, smooth glossy plastic finish, soft studio lighting, standing on a small round base",
    extras: "small stars, sparkles and hearts",
    original:
      "any existing toy line or brand; no brand names, logos or boxes with names",
    card: "the full-body figure doing a peace sign on its round base, front view",
    restyle:
      "a simple sculpted toy hairstyle and a minimal streetwear outfit on the small body",
  },
  "K-Pop Idol": {
    title: '"K-POP STAR" in glossy pastel idol-poster lettering with sparkles',
    style:
      "glamorous K-pop idol photocard look: trendy stage outfit, styled hair, soft glowing skin, pastel stage lights and bokeh, sparkly and polished",
    poses:
      "finger heart with a wink, peace sign by the face, big smile with hands in a heart shape over the head, singing into a microphone, dance pose, waving to fans, chin on hand cute pose, thumbs up, blowing a kiss",
    poses2:
      "winking with a peace sign under the chin, aegyo cheek poke, holding a fan sign board, stage jump with confetti, airport fashion walk with sunglasses, eating tteokbokki, hugging a plush toy, mic drop pose, waving goodbye with both hands",
    extras: "finger hearts, sparkles, stars, light sticks and music notes",
    original: "any real K-pop idol or group; no group names or logos",
    restyle:
      "a styled K-pop idol hairstyle (soft layered fringe, possibly a pastel tint) and a trendy stage or airport-fashion outfit",
  },
  "Pop Art": {
    title: '"POP ART" in bold 1960s pop-art lettering on a dotted panel',
    style:
      "1960s pop-art screen-print: flat bold primary colours, thick black outlines, big Ben-Day dots, bright single-colour square background behind each figure",
    extras: "dots, stars, small burst shapes and hearts",
    original: "any existing artwork",
    restyle:
      "a bold 1960s hairstyle (bouffant, flip or quiff) and a bright 60s outfit",
  },
  "Renaissance Portrait": {
    title:
      '"RENAISSANCE" in elegant gold classical lettering in an ornate frame',
    style:
      "classical Renaissance oil painting: rich deep colours, soft dramatic light, fine brush texture, elegant period clothing with velvet and lace, each sticker inside a small ornate gold frame",
    poses:
      "proud portrait with a slight smile, peace sign with a wink, holding a teacup, hand on chest noble pose, holding a smartphone selfie, thumbs up, holding a flower, waving, laughing behind a fan",
    poses2:
      "playing a lute, holding a quill and scroll, sipping from a goblet, posing with a small dog, reading an old book, holding a mirror, laughing with a hand over the mouth, crown on the head, gazing out of a window",
    extras: "gold frame flourishes, laurel leaves, roses and sparkles",
    original: "any existing painting",
    card: "waist-up classical portrait with a slight smile and a peace sign, inside a small ornate gold frame",
    restyle:
      "an elegant period hairstyle and Renaissance clothing (velvet, lace collar, pearls)",
  },
};

function lookFor(label: string): Look {
  return (
    LOOKS[label] ?? {
      title: `"${label.toUpperCase()}" in bold lettering that matches the style`,
      style: `${label} style`,
      extras: "hearts, stars, sparkles",
    }
  );
}

/** Poses new sets are picked from (ones a style hasn't used yet come first). */
const POSE_POOL = [
  "jumping with joy",
  "heart hands",
  "taking a selfie with a phone",
  "laughing so hard holding the tummy",
  "surprised with hands on cheeks",
  "eating a slice of pizza",
  "sleepy yawn hugging a pillow",
  "giving a high five",
  "confident salute",
  "blowing a kiss",
  "shy smile hiding behind hands",
  "thinking with a finger on the chin",
  "holding a big balloon",
  "reading a book",
  "playing a guitar",
  "dancing with arms up",
  "sitting cross-legged with a laptop",
  "holding a coffee cup with both hands",
  "cheering with a fist pump",
  "making a silly face with tongue out",
  "holding an umbrella in the rain",
  "hugging a teddy bear",
  "riding a bicycle",
  "holding a bunch of flowers",
  "wearing a party hat with confetti",
  "taking a photo with a camera",
  "pointing up with an idea",
  "crying happy tears",
  "angry pout with folded arms",
  "sleeping with Zzz",
  "running fast",
  "waving a little flag",
  "holding an ice cream cone",
  "stretching after waking up",
  "facepalm laughing",
  "OK hand sign with a wink",
  "holding a gift box",
  "rock-on hand sign",
];

/** The two built-in sets for a style. */
function builtInSets(label: string): string[] {
  const look = lookFor(label);
  return [look.poses ?? POSES, look.poses2 ?? POSES_2];
}

/** A style's pose sets: the admin's own (Set 1, Set 2…), else the two built-in ones. */
export function avatarPoseSets(style: {
  label: string;
  poseSets?: string[];
}): string[] {
  return style.poseSets?.length ? style.poseSets : builtInSets(style.label);
}

/** Nine poses for a new set — ones the style's sets haven't used yet first. */
export function nextPoseSet(existing: string[]): string {
  const used = existing.join(",").toLowerCase();
  const fresh = POSE_POOL.filter((p) => !used.includes(p.toLowerCase()));
  const pick = [...fresh, ...POSE_POOL.filter((p) => !fresh.includes(p))];
  // Rotate by the set count so repeated adds don't all start the same.
  const start =
    fresh.length >= 9 ? 0 : (existing.length * 9) % POSE_POOL.length;
  return [...pick.slice(start), ...pick.slice(0, start)].slice(0, 9).join(", ");
}

/**
 * The sheet is cut on a plotter and peeled by hand: every sticker must be its
 * own island with a wide empty gap around it — said plainly, since image tools
 * don't measure millimetres.
 */
const SPACING =
  "SPACING IS VERY IMPORTANT: every sticker, including the title, must be a completely separate island with a wide empty gap of plain white paper all the way around it — about 8 to 10 mm, roughly one tenth of a sticker's width. No two stickers may touch, overlap or nearly touch, and nothing (hair, hands, props, decorations, sparkles, shadows) may cross into the gaps. Keep every decoration inside its own sticker's white border. Leave a 10 mm empty margin around the edge of the page. Make the stickers a little smaller if needed to keep the gaps; the gaps must be even and clearly visible so each sticker can be cut out on a plotter and peeled off easily.";
const SPACING_REMINDER =
  "Before finishing, check the gaps: all 10 stickers stand apart with clear white space between them, none touching.";

/** Split a set's pose list into single poses. */
const posesOf = (list: string) =>
  list
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

function build(
  label: string,
  who: "girl" | "boy" | "photo",
  poses: string,
  set: number,
  note = "",
  avoid: string[] = [],
): string {
  const look = lookFor(label);
  const subject = who === "girl" ? GIRL : who === "boy" ? BOY : PHOTO;
  const parts = [
    ...(who === "photo"
      ? [
          "Turn the person in the attached photo into a sticker sheet of themselves.",
        ]
      : []),
    "A4 portrait sticker sheet on a pure white background.",
    `At the top, a bold die-cut sticker title logo reading ${look.title}.`,
    `Below it, a 3×3 grid of 9 separate die-cut stickers of ${subject}, all the same size, each with a thick even white sticker border and no drop shadow. The outer die-cut edge of every sticker is plain white only: no black, grey or coloured outline or cut line around the outside of the white border.`,
    ...(who === "photo"
      ? [
          LIKENESS,
          `Restyle them in this style, for example with ${look.restyle ?? RESTYLE_DEFAULT(label)}. OUTFITS MUST BE DIFFERENT: give each of the nine stickers its own outfit — a different garment, colour and pattern every time (for example a jacket in one, a dress or kurta in another, a hoodie, a shirt, a sweater…), chosen at random within this style. No two stickers may wear the same clothes or the same colours, and no outfit may repeat across the sheet. Vary the hairstyle too (different looks in this style, to suit each pose). Any clothes mentioned in the style description are only ideas, not a uniform. The face stays the same person in every sticker.`,
        ]
      : []),
    // The sheet is cut on a plotter: every sticker needs clear space around its cut line.
    SPACING,
    `Style: ${look.style}.`,
    `Each sticker shows a different pose and expression: ${poses}.`,
    `Inside each sticker's border, around the character: ${look.extras}.`,
    "Bright, clean, high detail, print-ready.",
    who === "photo"
      ? `Make it look like the person, not like ${look.original ?? "any existing character"} or a celebrity. Keep it friendly and family-safe. No other text.`
      : `Original character, not based on ${look.original ?? "any existing character"} or any real person. No other text.`,
  ];
  // Said again last: image tools tend to pack stickers tight unless reminded.
  parts.push(SPACING_REMINDER);
  if (who === "photo")
    parts.push("Also check the clothes: all nine stickers wear different outfits, none the same.");
  // The AI tool can't see the other sets, so name their poses outright.
  if (avoid.length)
    parts.push(
      `Use exactly the nine poses above. Do not use any of these poses: ${avoid.join(", ")}.`,
    );
  if (who === "boy")
    parts.push(
      `If the girl sheet for this style${set > 1 ? ` (set ${set})` : ""} is attached, use the same art style, colours and layout as it.`,
    );
  if (who === "photo" && note.trim())
    parts.push(
      `The customer asked: "${note.trim()}" — follow this where it fits the style.`,
    );
  return parts.join(" ");
}

/** One sticker for the style card (square, shown small, so big and simple). */
function buildCard(label: string, who: "girl" | "boy"): string {
  const look = lookFor(label);
  const parts = [
    "A single die-cut sticker, square 1:1 image, on a transparent background (or pure white if transparency isn't possible).",
    `The sticker shows ${who === "girl" ? GIRL : BOY}.`,
    `Pose: ${look.card ?? "waist-up, a peace sign with a wink and a big happy smile, looking at the viewer"}.`,
    `Style: ${look.style}.`,
    // A card pose brings its own extras; the sheet's list is too busy for one sticker.
    `A few small decorations inside the sticker: ${look.card ? "small stars and hearts" : look.extras}.`,
    "Thick even white sticker border around the whole design, with a soft shadow. The outer edge of the white border is plain white: no black, grey or coloured outline or cut line around it. Centred, filling about 90% of the image, with a small even margin on all sides and nothing cut off.",
    "Big, clear face that still reads well when shown small on a phone. Bright, clean, high detail.",
    `Original character, not based on ${look.original ?? "any existing character"} or any real person. No text${look.card?.includes('"') ? " other than the words above" : ""}.`,
  ];
  if (who === "boy")
    parts.push(
      "If the girl card picture for this style is attached, use the same art style, colours, pose and framing.",
    );
  return parts.join(" ");
}

/**
 * A sample or client sheet for set `index` of a style's pose sets (attach the
 * client's photo for "photo"). The prompt stands on its own for pasting into
 * ChatGPT: it carries this set's poses and lists the other sets' poses to avoid.
 */
export function avatarSheetPrompt(
  label: string,
  who: "girl" | "boy" | "photo",
  sets: string[],
  index: number,
  note = "",
): string {
  const poses = sets[index] ?? "";
  const mine = new Set(posesOf(poses).map((p) => p.toLowerCase()));
  const avoid = [
    ...new Set(
      sets
        .filter((_, n) => n !== index)
        .flatMap(posesOf)
        .filter((p) => !mine.has(p.toLowerCase())),
    ),
  ];
  return build(label, who, poses, index + 1, note, avoid);
}

/** The style card picture (one sticker). */
export function avatarCardPrompt(label: string, who: "girl" | "boy"): string {
  return buildCard(label, who);
}
