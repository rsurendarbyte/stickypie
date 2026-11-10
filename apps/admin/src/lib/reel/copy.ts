// Words that go with a reel: Instagram caption, YouTube Shorts title /
// description / tags, Meta ad settings and audience segments. Built from the
// product, no AI call. House rules: posters are "premium poster paper", never
// waterproof / UV / GSM claims, no pie or bakery words.
import type { ReelKind, ReelProduct } from "./types";

export type AdSegment = { name: string; who: string; age: string; interests: string[]; budget: string; note?: string };
export type ReelCopy = {
  link: string;
  caption: string;
  youtube: { title: string; description: string; tags: string[] };
  ad: { primary: string; headline: string; description: string; cta: string; settings: string[]; warnings: string[] };
  segments: AdSegment[];
};

type Theme = { id: string; words: string[]; label: string; interests: string[]; tags: string[]; realPeople?: boolean };

const THEMES: Theme[] = [
  { id: "cars", label: "car lovers", words: ["car", "supra", "mustang", "jdm", "muscle", "drive", "garage", "racing", "porsche", "bmw"], interests: ["Cars", "Sports cars", "JDM", "Car tuning", "Top Gear", "Formula One", "Autocar India"], tags: ["car poster", "jdm poster", "car wall art", "car room decor"] },
  { id: "bikes", label: "bikers", words: ["bike", "motorcycle", "rider", "royal enfield", "ktm", "ride"], interests: ["Motorcycles", "Royal Enfield", "KTM", "Motorcycle touring", "Road trips"], tags: ["bike poster", "motorcycle poster", "rider wall art"] },
  { id: "cricket", label: "cricket fans", words: ["cricket", "kohli", "dhoni", "virat", "rohit", "ipl", "thala", "run machine"], interests: ["Cricket", "Indian Premier League", "Indian national cricket team", "ESPNcricinfo"], tags: ["cricket poster", "cricket wall art", "ipl poster"], realPeople: true },
  { id: "football", label: "football fans", words: ["football", "ronaldo", "messi", "cr7", "neymar"], interests: ["Association football", "Cristiano Ronaldo", "UEFA Champions League", "Premier League"], tags: ["football poster", "ronaldo poster", "football room decor"], realPeople: true },
  { id: "cinema", label: "movie fans", words: ["thalapathy", "rajini", "thalaivar", "vijay", "pushpa", "superstar", "cinema", "movie", "chaplin", "kollywood", "tollywood", "bollywood"], interests: ["Tamil cinema", "Telugu cinema", "Bollywood", "Movies", "Movie posters"], tags: ["movie poster", "tamil cinema poster", "fan poster"], realPeople: true },
  { id: "travel", label: "travellers", words: ["travel", "city", "beach", "mountain", "coastal", "sunset", "road trip", "india"], interests: ["Travel", "Backpacking", "Road trips", "Adventure travel", "Lonely Planet"], tags: ["travel poster", "aesthetic poster", "travel wall art"] },
  { id: "devotional", label: "devotional homes", words: ["devotional", "god", "krishna", "shiva", "ganesh", "temple", "murugan", "hanuman"], interests: ["Hinduism", "Spirituality", "Meditation", "Bhakti"], tags: ["devotional poster", "god poster", "spiritual wall art"] },
  { id: "motivation", label: "hustlers", words: ["motivation", "mindset", "never give up", "hustle", "champion", "quote", "gods plan"], interests: ["Motivation", "Entrepreneurship", "Self-improvement", "Fitness and wellness"], tags: ["motivational poster", "quote poster", "study room poster"] },
  { id: "retro", label: "retro lovers", words: ["retro", "vintage", "neon", "80s", "eighties", "synthwave", "old school", "newspaper"], interests: ["Retro style", "Vintage clothing", "Synthwave", "Vaporwave"], tags: ["retro poster", "vintage poster", "neon aesthetic"] },
  { id: "anime", label: "anime fans", words: ["anime", "manga", "naruto", "one piece", "goku"], interests: ["Anime", "Manga", "Crunchyroll"], tags: ["anime poster", "manga poster"] },
];

export function themesOf(product: ReelProduct): Theme[] {
  const hay = [product.name, product.slug, ...product.tags, ...product.categories].join(" ").toLowerCase();
  const found = THEMES.filter((t) => t.words.some((w) => hay.includes(w)));
  return found.length ? found.slice(0, 2) : [{ id: "decor", label: "room decor lovers", words: [], interests: ["Interior design", "Home decor", "Wall art"], tags: ["wall poster", "room decor"] }];
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function reelCopy(product: ReelProduct, kind: ReelKind, pct: number, styleId: string, site = "https://stickypie.in"): ReelCopy {
  const themes = themesOf(product);
  const theme = themes[0];
  const realPeople = themes.some((t) => t.realPeople);
  const name = product.name.replace(/\s*mini poster\s*$/i, "").trim();
  const campaign = `${kind}-${product.slug}`.slice(0, 60);
  const utm = `utm_source=instagram&utm_medium=paid_social&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${styleId}`;
  const page = `${site}/sticker/${product.slug}`;
  const link = kind === "puzzle" ? `${page}?finish=puzzle&${utm}` : `${page}?${utm}`;

  const sizes = product.sizes.length ? product.sizes : [{ inches: 6, price: 60, was: null }];
  const sizeText = (inches: number) => (inches === 6 ? "4×6 in" : inches === 9 ? "6×9 in" : `${inches} in`);
  const priceText =
    kind === "puzzle"
      ? `9 cards build a 12×18 in poster for ₹199, or 18×27 in for ₹450`
      : kind === "wall"
        ? `${product.wall?.posters.length ?? ""} mini posters${product.wall?.feet ? `, about ${product.wall.feet} on your wall` : ""}, from ${rupees(product.price)}`
        : sizes.map((s) => `${sizeText(s.inches)} ${rupees(s.price)}`).join(" · ");

  const hook =
    kind === "puzzle"
      ? `Solve this poster before you buy it. Win ${pct}% off.`
      : kind === "wall"
        ? `A whole wall for ${theme.label}, in one box.`
        : `${name}, made for ${theme.label}.`;
  const body =
    kind === "puzzle"
      ? `Every StickyPie poster is a 9-card puzzle. Play it on the site, swap the cards back, and ${pct}% comes off your puzzle poster.\n\n${priceText}. Printed on premium poster paper.`
      : kind === "wall"
        ? `${name}: every poster picked to sit together, printed on premium poster paper and ready to stick up.\n\n${priceText}.`
        : `Printed on premium poster paper, sized for real walls.\n\n${priceText}.`;
  const hashtags = kind === "puzzle" ? ["#puzzleposter", "#roomdecor", `#${theme.tags[0].replace(/\s/g, "")}`] : ["#wallposter", "#roomdecor", `#${theme.tags[0].replace(/\s/g, "")}`];
  const caption = `${hook}\n\n${body}\n\nTap the link in bio to get yours.\n\n${hashtags.join(" ")}`;

  const ytTitle = (
    kind === "puzzle"
      ? `Solve this ${name} poster puzzle to win ${pct}% off #Shorts`
      : kind === "wall"
        ? `${name} wall set: ${product.wall?.posters.length ?? ""} posters, one wall #Shorts`
        : `${name} mini poster for your room #Shorts`
  ).replace(/\s+/g, " ").slice(0, 100);
  const ytDescription = `${hook}\n\n${body}\n\nGet it here: ${page}?utm_source=youtube&utm_medium=shorts&utm_campaign=${encodeURIComponent(campaign)}&utm_content=${styleId}\n\nStickyPie makes mini posters, puzzle posters and wall sets on premium poster paper.\n\n#Shorts #roomdecor #${theme.tags[0].replace(/\s/g, "")}`;
  const ytTags = unique([
    ...theme.tags,
    ...(themes[1]?.tags ?? []),
    kind === "puzzle" ? "puzzle poster" : kind === "wall" ? "wall poster set" : "mini poster",
    kind === "puzzle" ? "poster puzzle game" : "poster wall ideas",
    "room decor",
    "room makeover",
    "wall decor ideas",
    "aesthetic room",
    "bedroom decor india",
    "stickypie",
    name.toLowerCase(),
  ]).slice(0, 15);

  const settings = [
    `Objective: Sales (website purchases) if the Meta pixel is on the shop; otherwise Traffic → landing page views.`,
    `Placements: Advantage+ placements, but check Reels, Stories and Explore show the 9:16 video. Untick Audience Network.`,
    `Location: India. Language: leave open (captions in English).`,
    `Budget: start ₹300–500 a day per ad set for 4–5 days, then move money to the ad set with the lowest cost per purchase. Don't change an ad set for the first 3 days.`,
    `Schedule: run all day at first. After a week, check Analytics for the hours your orders come in before narrowing it.`,
    `Link: ${link}`,
    `UTM is already in the link, so Analytics can tell which video sold.`,
    `Test: put 3–4 styles of this same product in one ad set (Advantage+ creative off), keep the one with the best hold rate and cost per click after 3 days.`,
    kind === "puzzle"
      ? `The link opens the puzzle game straight away (?finish=puzzle), so the ad's promise matches the first screen.`
      : `Prices sit under the shop's ₹400 minimum, so the copy says "mix and match" in the ad text to push bigger baskets.`,
  ];
  const warnings = [
    ...(realPeople
      ? [`This poster shows a real cricketer / actor / footballer. Meta often rejects ads that use a famous person's face or a team logo without rights. Post it as an organic reel; for paid ads, use car, travel, retro or quote posters.`]
      : []),
    `Don't promise free or next-day delivery, or "waterproof". Stick to what's true: premium poster paper, the sizes and the prices.`,
  ];

  const segments: AdSegment[] = [
    {
      name: `A · ${cap(theme.label)}`,
      who: `People into ${theme.label}${themes[1] ? ` and ${themes[1].label}` : ""}`,
      age: "18–30",
      interests: unique([...theme.interests, ...(themes[1]?.interests ?? [])]).slice(0, 8),
      budget: "35%",
      note: "Your main test: the poster's own fans.",
    },
    {
      name: "B · Room makeover",
      who: "People decorating a bedroom, hostel or first flat",
      age: "18–34",
      interests: ["Interior design", "Home decor", "Bedroom", "Pinterest", "IKEA", "Wall art", "Do it yourself (DIY)"],
      budget: "25%",
    },
    {
      name: "C · College & hostel",
      who: "Students setting up rooms (education: in college / university)",
      age: "18–24",
      interests: ["College", "Hostel", "Exam preparation", ...theme.interests.slice(0, 2)],
      budget: "15%",
      note: "Cheapest clicks; push the ₹60 poster and the 4-poster mix in the text.",
    },
    kind === "puzzle"
      ? {
          name: "D · Puzzle & game players",
          who: "People who like puzzles and quick phone games",
          age: "18–35",
          interests: ["Puzzle video games", "Jigsaw puzzles", "Brain teasers", "Casual games", "Candy Crush"],
          budget: "15%",
          note: "The game is the hook; lead with the swap animation styles (Solve & win, Card deal).",
        }
      : {
          name: "D · Gifting",
          who: "People shopping for birthday or friendship gifts",
          age: "18–34",
          interests: ["Gifts", "Birthday", "Friendship", "Personalised gifts", "Online shopping"],
          budget: "15%",
          note: "Text: \"A gift that goes on their wall\".",
        },
    {
      name: "E · Warm (retargeting)",
      who: "Visited the shop in 30 days, or engaged with Instagram in 60 days, or added to cart in 14 days. Exclude buyers of the last 30 days.",
      age: "18–45",
      interests: ["Custom audience: website visitors 30d", "Custom audience: Instagram engagers 60d", "Custom audience: add to cart 14d", "Exclude: purchasers 30d"],
      budget: "10%",
      note: "Use the Price tag or Clean editorial style here: they already know the shop.",
    },
  ];
  segments.push({
    name: "F · Lookalike (later)",
    who: "1% lookalike of past buyers in India, once you have 100+ orders tracked by the pixel",
    age: "18–40",
    interests: ["Lookalike 1%: purchasers"],
    budget: "move 20% here when ready",
  });

  return {
    link,
    caption,
    youtube: { title: ytTitle, description: ytDescription, tags: ytTags },
    ad: {
      primary: `${hook} ${kind === "puzzle" ? `Play the 9-card puzzle on the site and ${pct}% comes off.` : "Mix and match posters for your wall."} Printed on premium poster paper.`,
      headline: kind === "puzzle" ? `Solve it. Save ${pct}%.` : kind === "wall" ? `${name}: the whole wall` : `${name} · from ${rupees(sizes[0].price)}`,
      description: priceText,
      cta: kind === "puzzle" ? "Get offer" : "Shop now",
      settings,
      warnings,
    },
    segments,
  };
}

const unique = <T,>(a: T[]) => [...new Set(a)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
