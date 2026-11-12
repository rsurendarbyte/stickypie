// A wall set's description, written from its own posters, so every wall says
// what is on it (Google, AI answers, the Google feed and llms.txt all read it).
// Used by make-wall-setups.mjs for new walls and fix-wall-descriptions.mjs.

// The home page's wall rows (packages/shared/src/walls.ts WALL_THEMES), as words.
const THEME_WORDS = {
  festive: "Christmas and New Year",
  cars: "car",
  legends: "legends",
  ride: "ride and adventure",
  travel: "travel",
  india: "Incredible India",
  devotional: "devotional",
  motivational: "motivational",
  retro: "retro",
};

/** "Chase the Sun — Mini Poster" → "Chase the Sun". */
export function posterTitle(name) {
  return name.replace(/\s*[—–-]\s*Mini Poster$/i, "").replace(/\s+Mini Poster$/i, "").trim();
}

/** "Supra Street Wall Setup — 6 Mini Poster Pack" → "Supra Street". */
export function wallTitle(name) {
  return name.replace(/\s*[—–-]\s*\d+\s+Mini Poster Pack$/i, "").replace(/\s*Wall Setup$/i, "").trim();
}

/**
 * "Supra Street: a car wall of 6 mini posters that go up together: Supra MK4,
 * Tokyo Nights, Drift King and 3 more. About 1.2 × 1.5 ft on your wall, …"
 */
export function wallDescription({ name, posterNames, feet, theme }) {
  const titles = [...new Set(posterNames.map(posterTitle).filter(Boolean))];
  const shown = titles.slice(0, 4);
  const more = posterNames.length - shown.length;
  // a poster name with a comma in it ("Life Is a Game, Play It") needs semicolons between names
  const sep = shown.some((t) => t.includes(",")) ? "; " : ", ";
  const list = more > 0 ? `${shown.join(sep)} and ${more} more` : shown.length > 1 ? `${shown.slice(0, -1).join(sep)} and ${shown.at(-1)}` : shown[0];
  const title = wallTitle(name);
  // "Incredible India: an Incredible India wall" says it twice
  const word = THEME_WORDS[theme] && !title.toLowerCase().includes(THEME_WORDS[theme].toLowerCase()) ? THEME_WORDS[theme] : null;
  const kind = word ? `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word} wall` : "a wall";
  const size = feet ? `About ${feet} on your wall, printed` : "Printed";
  return `${title}: ${kind} of ${posterNames.length} mini posters that go up together: ${list}. ${size} on premium poster paper. Glue dots or double-sided tape included.`;
}

/** The theme and size a wall row keeps in its tags. */
export function wallTagFacts(tags) {
  const theme = tags.find((t) => t.startsWith("wall theme:"))?.slice("wall theme:".length);
  const feet = tags.find((t) => t.startsWith("wall size:"))?.slice("wall size:".length);
  return { theme, feet };
}
