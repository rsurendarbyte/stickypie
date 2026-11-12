// "Where it goes" landing pages: /car-stickers, /bike-stickers, … These match
// how people search ("car stickers online India") rather than our theme
// categories. Which stickers show is decided by tags and categories, both
// edited in the admin — add the tag "laptop" to a sticker and it appears on
// /laptop-stickers.
import { POSTER_ADHESIVE, POSTER_PAPER, festivalLongDate, type Category, type Festival, type Product } from "@stickypie/shared";
import { isListed, isPoster, isPosterPack, isSinglePoster } from "./poster";

export type Surface = {
  slug: string;
  /** "Car Stickers" — H1 and title. */
  name: string;
  /** Short noun for copy: "car". */
  noun: string;
  title: string;
  description: string;
  intro: string;
  /** Tags (lower-case) that put a sticker here. */
  tags: string[];
  /** Category slugs whose stickers belong here. */
  categories: string[];
  sections: { heading: string; body: string }[];
  faq: { q: string; a: string }[];
  /** Festival pages: "1 November", shown under the heading. */
  when?: string;
  /** Poster pages: lists posters and wall sets only, never the other stickers. */
  posters?: boolean;
  /** The puzzle posters page: every single mini poster, as a puzzle poster. */
  puzzle?: boolean;
  /** A poster page that also lists its matching stickers under this heading ("Ramayana stickers"). */
  stickers?: string;
  /** A sticker page that lists only its own stickers (no "more stickers"), then its matching posters under this heading. */
  alsoPosters?: string;
  /** The sister page for the same subject (stickers ↔ posters), linked under the intro. */
  related?: { href: string; label: string };
};

export const SURFACES: Surface[] = [
  {
    slug: "car-stickers",
    name: "Car Stickers",
    noun: "car",
    title: "Car Stickers Online in India – Die-Cut Vinyl Car Decals",
    description:
      "Buy car stickers online in India: die-cut vinyl decals for bumpers, windows and fuel flaps — JDM, racing, warning labels and more. Several sizes, shipped across India.",
    intro:
      "Bumper, rear window, fuel flap or dashboard — our car stickers are die-cut vinyl decals. Pick from JDM and racing designs, petrolhead slogans, warning labels and origin badges, each printed to order in the size you pick.",
    tags: ["car", "cars", "bumper", "jdm", "racing", "petrolhead", "fuel", "diesel", "petrol", "drift", "turbo", "tuning", "baby on board", "jeep", "4x4"],
    categories: ["cars", "jdm", "racing", "petrolhead", "signage", "warning", "origin", "off-road"],
    sections: [
      {
        heading: "Cut to the shape of the design",
        body: "Every car sticker is printed on vinyl and die-cut so the edge follows the design — no square white borders on your paint or glass.",
      },
      {
        heading: "Where car stickers look best",
        body: "Rear windscreen and quarter glass for big 6″–7″ designs, fuel flaps for petrol/diesel signs, bumpers for warning labels and badges, and the dashboard or glovebox for small 3″ ones.",
      },
    ],
    faq: [
      {
        q: "Can I put a sticker on the car glass?",
        a: "Yes — vinyl stickers stick cleanly to glass and can be peeled off later. Don't place them where they block your view or on the windscreen area the wipers cover.",
      },
      {
        q: "Will it damage the paint when I remove it?",
        a: "No. Warm it with a hair dryer and peel slowly; it comes off cleanly from factory paint. Any light residue wipes off with a little rubbing alcohol.",
      },
    ],
  },
  {
    slug: "bike-stickers",
    name: "Bike Stickers",
    noun: "bike",
    title: "Bike Stickers Online in India – Die-Cut Vinyl Bike Decals",
    description:
      "Shop bike stickers online in India: die-cut vinyl decals for tanks, side panels, visors and helmets — rider, off-road and adventure designs. Ships across India.",
    intro:
      "Tank, side panel, mudguard or visor — our bike stickers are die-cut vinyl decals built for riders, with rider, off-road and adventure designs in several sizes.",
    tags: ["bike", "bikes", "biker", "bikers", "motorcycle", "motocross", "ride", "rider", "helmet", "offroad", "trail", "adventure", "mountains"],
    categories: ["bikers", "off-road", "adventure", "racing"],
    sections: [
      {
        heading: "Cut to the shape of the design",
        body: "The die-cut shape hugs the design so it looks painted on, not stuck on.",
      },
      {
        heading: "Where bike stickers fit",
        body: "3″ stickers suit side panels, headlamp covers and helmets; 6″ and 7″ work on fuel tanks, tail sections and luggage boxes. Smooth, flat or gently curved surfaces give the cleanest finish.",
      },
    ],
    faq: [
      {
        q: "Can I stick one on a curved fuel tank?",
        a: "Yes. Vinyl flexes over gentle curves — press from the centre out and warm it slightly with a hair dryer to help it settle on tighter curves.",
      },
      {
        q: "What size sticker should I get for my bike?",
        a: "3″ for helmets, side panels and small spaces; 6″ or 7″ for tanks and luggage boxes. Use \"See actual size\" on any sticker to check it on your screen.",
      },
    ],
  },
  {
    slug: "laptop-stickers",
    name: "Laptop Stickers",
    noun: "laptop",
    title: "Laptop Stickers Online in India – Die-Cut Vinyl Laptop Decals",
    description:
      "Buy laptop stickers online in India: die-cut vinyl stickers for MacBooks, laptops and tablets — memes, funny quotes, car culture and more. Peel off cleanly, ships across India.",
    intro:
      "Make your laptop yours. Our laptop stickers are die-cut vinyl and easy to peel off without leaving residue — so you can build a lid full of memes, car culture and good vibes, and change it whenever you like.",
    tags: ["laptop", "macbook", "funny", "meme", "memes", "gaming", "cute", "good vibes", "positive", "aesthetic", "anime", "shaka"],
    categories: ["fun", "anime", "gaming", "computer-geek", "aesthetic"],
    sections: [
      {
        heading: "Stickers that look good on any lid",
        body: "Die-cut edges mean no awkward white boxes — just the design, sitting flat on your MacBook, Windows laptop, tablet or phone case. 3″ stickers are the classic laptop size; mix a few to fill the lid.",
      },
      {
        heading: "Peel off clean when you upgrade",
        body: "Vinyl comes away cleanly from laptop lids, so selling or swapping your laptop later isn't a problem.",
      },
    ],
    faq: [
      {
        q: "Will laptop stickers leave residue?",
        a: "No. They peel off cleanly from aluminium and plastic lids. If a little adhesive stays behind, a drop of rubbing alcohol on a cloth removes it.",
      },
      {
        q: "What size works best on a laptop?",
        a: "3″ is the classic size for building a sticker collage; 6″ makes a single statement design. Check \"See actual size\" to preview it at real size on your screen.",
      },
      {
        q: "Can I use them on my MacBook?",
        a: "Yes — they stick well on MacBook lids. Keep them away from vents and the hinge so they don't block airflow.",
      },
    ],
  },
  {
    slug: "helmet-stickers",
    name: "Helmet Stickers",
    noun: "helmet",
    title: "Helmet Stickers Online in India – Die-Cut Vinyl Helmet Decals",
    description:
      "Shop helmet stickers online in India: small die-cut vinyl decals for bike and cycling helmets — rider, adventure and fun designs. Ships across India.",
    intro:
      "Give your lid some personality. Our helmet stickers are compact die-cut vinyl decals that flex over curves — rider slogans, adventure badges and fun designs, best in 3″.",
    tags: ["helmet", "bike", "biker", "bikers", "motocross", "ride", "rider", "offroad", "adventure"],
    categories: ["bikers", "off-road", "adventure"],
    sections: [
      {
        heading: "Small and flexible",
        body: "Helmets are curved, so the 3″ size works best: it settles smoothly on the shell without lifting at the edges.",
      },
      {
        heading: "Stick it safely",
        body: "Place stickers on the shell only — never on the visor where they'd block your view, and keep any safety or certification labels visible.",
      },
    ],
    faq: [
      {
        q: "What size sticker fits a helmet?",
        a: "3″ is ideal for most helmets. Larger sizes can work on the back of full-face helmets with a broad, flat area.",
      },
      {
        q: "Will the sticker lift on a curved helmet?",
        a: "Press it on from the centre outwards and warm it gently with a hair dryer — the vinyl softens and settles into the curve.",
      },
      {
        q: "Can I stick it on the visor?",
        a: "We don't recommend it — anything on the visor can block your view. Keep stickers on the helmet shell.",
      },
    ],
  },
  {
    slug: "bottle-stickers",
    name: "Bottle Stickers",
    noun: "water bottle",
    title: "Water Bottle Stickers Online in India – Die-Cut Vinyl Stickers",
    description:
      "Buy water bottle stickers online in India: die-cut vinyl stickers for steel bottles, flasks and tumblers — funny, cute and good-vibes designs. Ships across India.",
    intro:
      "Your bottle goes everywhere — make it unmistakably yours. These die-cut vinyl stickers come in funny, cute and good-vibes designs in a bottle-friendly 3″ size.",
    tags: ["bottle", "water bottle", "flask", "funny", "cute", "good vibes", "positive", "shaka", "meme", "memes"],
    categories: ["fun", "aesthetic", "motivational"],
    sections: [
      {
        heading: "The right size for bottles",
        body: "3″ stickers fit most 500 ml–1 L bottles and flasks. Stick them on a clean, dry, room-temperature bottle and let them set for a day before washing.",
      },
    ],
    faq: [
      {
        q: "Will they stick to a steel bottle?",
        a: "Yes. Clean the bottle with a little rubbing alcohol first so the adhesive grips the steel properly.",
      },
      {
        q: "What size fits a water bottle?",
        a: "3″ fits most bottles and flasks. Use \"See actual size\" on a sticker to check it against your bottle.",
      },
    ],
  },  {
    slug: "ramayana-stickers",
    name: "Ramayana Stickers",
    noun: "Ramayana",
    title: "Ramayana Stickers Online in India – Lord Rama, Hanuman & Jai Shri Ram Stickers",
    description:
      "Buy Ramayana stickers online in India: cute die-cut vinyl stickers of Lord Rama, Sita, Lakshmana, baby Hanuman, the Ram Setu squirrel, the राम stone and the Ayodhya Ram Mandir for your laptop, bottle, phone, car or bike.",
    intro:
      "Cute Ramayana stickers for your laptop, water bottle, phone, car or bike: chibi Lord Rama, Sita and Lakshmana, baby Hanuman flying with his gada and lifting the Sanjeevani mountain, the little Ram Setu squirrel, the floating राम stone, the Ayodhya Ram Mandir, Shabari feeding Rama berries, Jatayu, King Dasharatha and a cartoon Ravana. Each one is a die-cut vinyl sticker, cut to the shape of the design.",
    tags: ["ramayana", "ramayan"],
    categories: [],
    alsoPosters: "Ramayana posters for your wall",
    related: { href: "/ramayana-posters", label: "See the Ramayana wall posters" },
    sections: [
      {
        heading: "Jai Shri Ram on the go",
        body: "Put a Ram Setu राम stone on your car's rear glass, baby Hanuman on your bike's tank, or chibi Rama, Sita and Lakshmana on your laptop. The 3″ size fits bottles and phones, 6″ and 7″ suit cars and laptops.",
      },
      {
        heading: "Made for kids and gifting",
        body: "The chibi characters and the Ram Setu squirrel make the Ramayana fun for kids, and a few stickers are an easy return gift for Ram Navami, Dussehra, Diwali or a birthday.",
      },
    ],
    faq: [
      {
        q: "Which Ramayana stickers do you have?",
        a: "Chibi Lord Rama, Sita and Lakshmana, baby Hanuman flying and baby Hanuman with the Sanjeevani mountain, the Ram Setu squirrel, the floating राम stone, the Ayodhya Ram Mandir, Shabari feeding Rama berries, Jatayu, King Dasharatha and a cartoon Ravana.",
      },
      {
        q: "Can I put a Ram sticker on my car or bike?",
        a: "Yes. They are die-cut vinyl, so they stick cleanly to glass, paint and tanks and peel off later. Don't place one where it blocks your view.",
      },
      {
        q: "Do you have Ramayana posters too?",
        a: "Yes: Lord Rama, Sita, Hanuman, Ravana, Ram Setu, Lanka Dahan and more as epic movie-style wall posters, single or as ready wall sets, on the Ramayana posters page.",
      },
    ],
  },
];

const POSTER_BASICS = `Printed to order on ${POSTER_PAPER}, in 4 × 6 in and 6 × 9 in, with ${POSTER_ADHESIVE} included.`;

/**
 * What people search for when they want posters: /wall-posters plus a page per
 * subject. Mini posters also carry the tags "car" and "bike" (they can be
 * stickers too), so subject pages go by the words below, never those two.
 */
export const POSTER_SURFACES: Surface[] = [
  {
    slug: "wall-posters",
    name: "Wall Posters",
    noun: "wall",
    title: "Wall Posters Online in India – Poster Sets & Mini Posters",
    description:
      "Buy wall posters online in India: ready wall poster sets and single mini posters of cars, bikes, film stars, cricket, travel and more, on premium poster paper.",
    intro: `Ready wall poster sets and single mini posters for your bedroom, hostel room, office or garage. ${POSTER_BASICS} Pick a set that's already matched, or swap any poster in it for one you like more.`,
    tags: ["mini poster", "poster pack"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Wall poster sets",
        body: `A wall poster set is a group of matching mini posters planned to go up together, so you get a full wall without working out what fits. Every set shows how much wall it covers, and each one comes with ${POSTER_ADHESIVE}.`,
      },
      {
        heading: "Single mini posters",
        body: `Want just one? Every mini poster comes as a wall poster on ${POSTER_PAPER} in 4 × 6 in or 6 × 9 in, or as a 9-card puzzle poster that makes one big 12 × 18 in or 18 × 27 in poster, whichever suits the spot you have in mind.`,
      },
    ],
    faq: [],
  },
  {
    slug: "puzzle-posters",
    name: "Puzzle Posters",
    noun: "puzzle",
    title: "Puzzle Posters Online in India – 9-Piece Poster Puzzles",
    description:
      "Buy puzzle posters online in India: any mini poster printed as 9 cards that join into one big wall poster, 12 × 18 in or 18 × 27 in. Solve the puzzle online to win a discount.",
    intro: `A puzzle poster is any of our mini posters printed as 9 cards that fit together into one big poster on your wall: 9 cards of 4 × 6 in make a 12 × 18 in poster, 9 cards of 6 × 9 in make an 18 × 27 in poster. Every card is printed on ${POSTER_PAPER}, with ${POSTER_ADHESIVE} included.`,
    tags: [],
    categories: [],
    posters: true,
    puzzle: true,
    sections: [
      {
        heading: "How a puzzle poster works",
        body: "You get 9 printed cards, each one piece of the poster. Lay them out 3 by 3 and stick them up side by side, and they join into one big poster, about three times the size of the mini poster.",
      },
      {
        heading: "Play the puzzle online",
        body: "Every puzzle poster has a free online puzzle: the poster is cut into 9 tiles and shuffled, and you swap tiles until it's whole again. It takes about 30 seconds, and solving it wins a discount on your order.",
      },
    ],
    faq: [],
  },
  {
    slug: "calendar-2027",
    name: "2027 Wall Calendars",
    noun: "calendar",
    title: "2027 Wall Calendar Online in India – Car, Offroad, Law, Christmas, Ramayana & More",
    description:
      "Buy a 2027 wall calendar online in India: 12 month posters that go up together as one wall. Car, offroad, India, law, Christmas, Ramayana and Mahabharata calendars on premium poster paper.",
    intro: `A 2027 calendar that is also a poster wall: 12 month posters that go up together. Pick the car calendar (a different car every month), the offroad calendar (a 4x4 on a famous Indian trail every month), the India calendar (a famous Indian place every month), the law calendar (advocates, courts and the Constitution, one legal day each month), the Christmas calendar (Indian churches, streets and hill towns in Christmas lights), the Ramayana calendar (from the princes of Ayodhya to Rama's return) or the Mahabharata calendar (the epic told month by month, from Bhishma's vow to the Bhagavad Gita). Each month is a 4 × 6 in poster on ${POSTER_PAPER}, ${POSTER_ADHESIVE} included.`,
    tags: ["2027 calendar"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "A calendar you can see from across the room",
        body: "All 12 months stay on the wall at once, so the whole year is in view: no flipping pages, and you can still plan next month at a glance. The months go up four across, with every other column set half a poster lower, and the wall covers about 1.4 × 1.8 ft.",
      },
      {
        heading: "A New Year gift that lasts all year",
        body: "A calendar wall makes an easy New Year or Christmas gift for a car lover, a lawyer or law student, a friend in a hostel room or a new home. It comes as the full set of 12 months, ready to put up.",
      },
      {
        heading: "Seven calendars to pick from",
        body: "Car calendar: a different car on the road every month. Offroad calendar: a 4x4 on the Rann of Kutch, Spiti, Pangong Lake, Sela Pass and other Indian trails. India calendar: the Red Fort, the Taj Mahal, Varanasi and more. Law calendar: Republic Day, legal aid under a banyan tree, a woman advocate in court, Ambedkar Jayanti, a moot court, mediation, Constitution Day and Human Rights Day. Christmas calendar: Christ Church in Shimla, Park Street in Kolkata, Bom Jesus in Goa and other Christmas scenes from across India, one for every month. Ramayana calendar: Rama's story month by month, from breaking Shiva's bow and the golden deer to Hanuman, Ram Setu and the return to Ayodhya. Mahabharata calendar: twelve moments of the epic in story order, from Bhishma's vow and Draupadi's swayamvar to the Bhagavad Gita and the journey to the Himalayas.",
      },
    ],
    faq: [
      {
        q: "Which 2027 calendars can I buy?",
        a: "Seven: the car calendar, the offroad calendar, the India calendar, the law calendar, the Christmas calendar, the Ramayana calendar and the Mahabharata calendar. Each is 12 month posters that go up together as one wall.",
      },
      {
        q: "Is there a Mahabharata calendar for 2027?",
        a: "Yes. The 2027 Mahabharata calendar shows one moment of the story each month, in order: Bhishma's vow, Arjuna and the bird's eye, the house of lac, Draupadi's swayamvar, the palace of illusions, the game of dice, Krishna saving Draupadi, the Yaksha's questions, Krishna's universal form, the Bhagavad Gita, Bhishma on the bed of arrows and the journey to the Himalayas.",
      },
      {
        q: "Is there a Ramayana calendar for 2027?",
        a: "Yes. The 2027 Ramayana calendar tells Rama's story in order, one moment a month: the princes of Ayodhya, breaking Shiva's bow, leaving for the forest, Bharata's devotion, the golden deer, Jatayu, Shabari's berries, Rama meeting Hanuman, Hanuman finding Sita, building Ram Setu, the victory of good and the return to Ayodhya.",
      },
      {
        q: "Is there an offroad calendar for 2027?",
        a: "Yes. Every month of the 2027 offroad calendar is a 4x4 on a famous Indian trail in its best season, from the white Rann of Kutch in January to the Auli snow trail in December.",
      },
      {
        q: "Is there a law calendar for 2027 for lawyers and advocates?",
        a: "Yes. The 2027 law calendar marks one legal day each month: Republic Day, World Day of Social Justice, Women's Day, Ambedkar Jayanti, Labour Day, World Environment Day, the Supreme Court, Independence Day, a moot court, mediation, Constitution Day on November 26 and Human Rights Day. It makes a good gift for an advocate's office, a law firm or a law student's room.",
      },
      {
        q: "Is there a Christmas calendar for 2027?",
        a: "Yes. Every month of the 2027 Christmas calendar is a Christmas scene from India, like Christ Church in Shimla, the Gateway of India in lights, Park Street in Kolkata and a Kerala houseboat with a star. It makes a good Christmas gift that stays up all year.",
      },
      {
        q: "Can I buy a single month?",
        a: "No. The 2027 calendars are sold as the full set of 12 months only, so the wall always has the whole year.",
      },
      {
        q: "What size is the 2027 calendar wall?",
        a: "Each month is a 4 × 6 in poster. All 12 together cover about 1.4 × 1.8 ft of wall.",
      },
      {
        q: "How do I put the calendar on the wall?",
        a: `Each month comes with ${POSTER_ADHESIVE}. Start with January at the top left and work across, four months to a row.`,
      },
    ],
  },
  {
    slug: "car-posters",
    name: "Car Posters",
    noun: "car",
    title: "Car Posters Online in India – Car Wall Posters & Sets",
    description:
      "Buy car posters online in India: wall poster sets and mini posters of classic cars, JDM legends, supercars and 4x4s on premium poster paper.",
    intro: `Classic cars, JDM legends, supercars, muscle cars and 4x4 builds for a petrolhead's wall. ${POSTER_BASICS}`,
    tags: ["wall theme:cars", "classic car", "race car", "muscle car", "sports car", "retro car", "jdm", "porsche", "ferrari", "bmw", "mustang", "toyota", "volkswagen", "4x4", "f1", "formula 1"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "A car wall for your room or garage",
        body: "Go for one ready car wall, or mix blueprint-style drawings with bold single cars. Bigger 6 × 9 in posters make a good centre, with 4 × 6 in posters around them.",
      },
    ],
    faq: [
      {
        q: "Which car posters do you have?",
        a: "Classic cars, Porsche, Ferrari, BMW, Mustang, Toyota, Volkswagen, 4x4 and off-road builds, and Formula 1 designs, as single mini posters and as ready wall sets.",
      },
    ],
  },
  {
    slug: "bike-posters",
    name: "Bike Posters",
    noun: "bike",
    title: "Bike Posters Online in India – Motorcycle Wall Posters",
    description:
      "Buy bike posters online in India: motorcycle wall poster sets and mini posters, from cafe racers to Royal Enfield, on premium poster paper.",
    intro: `Motorcycles, cafe racers, Royal Enfield and ride-ready adventure scenes for a rider's wall. ${POSTER_BASICS}`,
    tags: ["wall theme:ride", "motorcycle", "biker", "royal enfield", "cafe racer", "motocross"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Ride walls",
        body: "Ride and adventure sets put bikes and open roads together, ready to go up side by side. Add a single mini poster of your own bike's style to finish it off.",
      },
    ],
    faq: [
      {
        q: "Do you have Royal Enfield posters?",
        a: "Yes. There are Royal Enfield mini posters, along with cafe racers and other motorcycles, and wall poster sets for riders.",
      },
    ],
  },
  {
    slug: "tamil-cinema-posters",
    name: "Tamil Cinema Posters",
    noun: "cinema",
    title: "Tamil Cinema Posters Online – Rajinikanth & Vijay Wall Posters",
    description:
      "Buy Tamil cinema posters online in India: Rajinikanth, Thalapathy Vijay and Kollywood wall posters and wall sets on premium poster paper.",
    intro: `Kollywood on your wall: Rajinikanth, Thalapathy Vijay and more of Tamil cinema's biggest names. ${POSTER_BASICS}`,
    tags: ["tamil cinema", "kollywood", "rajinikanth", "thalapathy"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Superstar walls",
        body: "Put your favourites up as a matched wall set, or pick one big 6 × 9 in poster for over your desk.",
      },
    ],
    faq: [
      {
        q: "Do you have Rajinikanth posters?",
        a: "Yes. Rajinikanth mini posters come as wall posters or puzzle posters, and some wall sets feature him too.",
      },
      {
        q: "Do you have Thalapathy Vijay posters?",
        a: "Yes. Vijay mini posters come as wall posters or puzzle posters, and some wall sets feature him too.",
      },
    ],
  },
  {
    slug: "sports-posters",
    name: "Sports Posters",
    noun: "sports",
    title: "Sports Posters Online in India – Cricket & Football Wall Posters",
    description:
      "Buy sports posters online in India: Virat Kohli, MS Dhoni, Ronaldo, cricket and football wall posters and wall sets on premium poster paper.",
    intro: `Cricket and football heroes for your wall, from Virat Kohli and MS Dhoni to Cristiano Ronaldo. ${POSTER_BASICS}`,
    tags: ["cricket", "football", "virat kohli", "ms dhoni", "cristiano ronaldo", "csk"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "For your room or your gym",
        body: "A single 6 × 9 in poster works well above a desk, and a wall set makes a good corner for a bedroom, hostel room or home gym.",
      },
    ],
    faq: [
      {
        q: "Do you have Virat Kohli and MS Dhoni posters?",
        a: "Yes. Both have mini posters that come as wall posters or puzzle posters, and some wall sets feature them too.",
      },
    ],
  },
  {
    slug: "motivational-posters",
    name: "Motivational Posters",
    noun: "motivation",
    title: "Motivational Posters Online in India – Quote Wall Posters",
    description:
      "Buy motivational posters online in India: quote wall posters and wall sets for your study table, office or gym, on premium poster paper.",
    intro: `Quotes and reminders for your study table, office or gym wall. ${POSTER_BASICS}`,
    tags: ["wall theme:motivational", "motivational", "quote", "hustle"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Where motivational posters work",
        body: "Above a study table, beside a monitor or facing the bench at the gym. Put them where you'll see them every day.",
      },
    ],
    faq: [
      {
        q: "Are these good for a study room or office?",
        a: "Yes. They're small enough to sit above a desk, and a wall set can cover a larger office or study wall.",
      },
    ],
  },
  {
    slug: "devotional-posters",
    name: "Devotional Posters",
    noun: "devotional",
    title: "Devotional Posters Online in India – God Wall Posters",
    description:
      "Buy devotional posters online in India: Shiva, Ganesha, Krishna, Lord Rama, Hanuman and Buddha wall posters and wall sets on premium poster paper.",
    intro: `Shiva, Ganesha, Krishna, Lord Rama, Hanuman, Buddha and more, for your pooja corner or living room. ${POSTER_BASICS}`,
    tags: ["wall theme:devotional", "devotional", "shiva", "mahadev", "ganesha", "krishna", "buddha", "spiritual", "ramayana", "hanuman", "mahabharata"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Calm walls",
        body: "Choose one poster for a quiet corner, or a wall set to fill a larger space in your living room or meditation area.",
      },
    ],
    faq: [
      {
        q: "Which devotional posters do you have?",
        a: "Shiva and Mahadev, Ganesha, Krishna, Buddha, Hanuman and a full set of Ramayana posters (Lord Rama, Sita, Ravana, Ram Setu and more), as single mini posters and as ready wall sets.",
      },
    ],
  },
  {
    slug: "ramayana-posters",
    name: "Ramayana Posters",
    noun: "Ramayana",
    title: "Ramayana Posters Online in India – Lord Rama, Hanuman & Ravana Wall Posters",
    description:
      "Buy Ramayana posters online in India: Lord Rama, Sita, Hanuman, Ravana, Ram Setu and Lanka Dahan wall posters in an epic movie-poster style, single or as ready wall sets, plus cute Ramayana stickers.",
    intro: `The Ramayana told as epic movie posters: Lord Rama with his bow, Sita, Hanuman's leap to Lanka, Ram Setu, Ravana on his throne and Rama's return to Ayodhya. ${POSTER_BASICS} Hang one Jai Shri Ram poster in your pooja corner, or the whole story as a wall.`,
    tags: ["ramayana", "ramayan"],
    categories: [],
    posters: true,
    stickers: "Ramayana stickers",
    related: { href: "/ramayana-stickers", label: "See all Ramayana stickers" },
    sections: [
      {
        heading: "The whole Ramayana, scene by scene",
        body: "Vanvaas (the exile), Lakshman Rekha, Jatayu, Hanuman's leap across the ocean, Lanka Dahan, Ram Setu, Sanjeevani, Sita's Agni Pariksha, the Rama–Ravana yuddh, Ravana Vadha and the return of Rama to Ayodhya, each painted as a cinematic poster with its own title.",
      },
      {
        heading: "Ramayana wall sets",
        body: "Ramayana Story puts nine scenes on one wall with Lord Rama in the middle, Jai Hanuman centres Hanuman and Ravana, and Rama vs Ravana is a smaller battle wall. Swap any poster in a set for another scene you like more.",
      },
      {
        heading: "For Ram Navami, Dussehra and Diwali",
        body: "A Ramayana poster makes a thoughtful gift for Ram Navami, Dussehra, Diwali or a griha pravesh, and suits a pooja room, a living room, a kid's room for bedtime stories or a hostel wall.",
      },
    ],
    faq: [
      {
        q: "Which Ramayana posters do you have?",
        a: "Lord Rama, Sita, Hanuman, Ravana, Jatayu, Lakshman Rekha, Ram Setu, Lanka Dahan, Sanjeevani, Vanvaas, the Rama–Ravana yuddh, Ravana Vadha and the return of Rama to Ayodhya, as single mini posters and as ready wall sets.",
      },
      {
        q: "Do you have Ramayana stickers?",
        a: "Yes: cute die-cut vinyl stickers of chibi Lord Rama, Sita and Lakshmana, baby Hanuman flying and lifting the Sanjeevani mountain, the Ram Setu squirrel and floating राम stone, the Ayodhya Ram Mandir, Shabari feeding Rama berries, Jatayu, King Dasharatha and a cartoon Ravana, for your laptop, bottle, phone, car or bike.",
      },
      {
        q: "Do you have Hanuman posters?",
        a: "Yes: Hanuman leaping across the ocean to Lanka, Lanka Dahan with his burning tail, and Hanuman carrying the Sanjeevani mountain, plus the Jai Hanuman wall set.",
      },
      {
        q: "Are these from a Ramayana movie?",
        a: "No. They are original artwork made for StickyPie in the style of a film poster, not stills or posters from any film or TV series.",
      },
      {
        q: "Can I put a Ramayana poster in my pooja room?",
        a: `Yes. They are printed on ${POSTER_PAPER} and come with ${POSTER_ADHESIVE}, so they go up without nails and come off without marking the wall.`,
      },
    ],
  },
  {
    slug: "travel-posters",
    name: "Travel Posters",
    noun: "travel",
    title: "Travel Posters Online in India – City & Road Trip Wall Posters",
    description:
      "Buy travel posters online in India: city, mountain, beach and road trip wall posters and wall sets on premium poster paper.",
    intro: `Cities, mountains, beaches and road trips, from Indian favourites to places on your list. ${POSTER_BASICS}`,
    tags: ["wall theme:travel", "wall theme:india", "travel", "road trip", "paris", "mumbai", "mountains", "beach"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "Your travel wall",
        body: "Line up the places you've been or the ones you're saving up for. Matching sets keep a travel wall looking like one idea.",
      },
    ],
    faq: [
      {
        q: "Do you have posters of Indian cities?",
        a: "Yes, there are posters of cities and places around India, plus Incredible India wall sets, alongside places abroad such as Paris and London.",
      },
    ],
  },
  {
    slug: "retro-posters",
    name: "Retro Posters",
    noun: "retro",
    title: "Retro Posters Online in India – Vintage Style Wall Posters",
    description:
      "Buy retro posters online in India: vintage style wall posters and wall sets on premium poster paper, shipped across India.",
    intro: `Old-school colours and vintage style for any room. ${POSTER_BASICS}`,
    tags: ["wall theme:retro", "retro", "vintage"],
    categories: [],
    posters: true,
    sections: [
      {
        heading: "A vintage look without the hunt",
        body: "Retro sets are matched to go together, so a whole wall keeps the same old-school feel.",
      },
    ],
    faq: [
      {
        q: "Can I mix retro posters with other posters?",
        a: "Yes. Open any wall set, tap × on a poster and pick another one in its place.",
      },
    ],
  },
];

/** A poster page's name mid-sentence: "car posters", "Tamil cinema posters". */
export function posterLabel(surface: Surface): string {
  // festival names stay capitalised: "Christmas posters"
  if (surface.when) return surface.name.replace(/ Posters$/, " posters");
  return surface.name.toLowerCase().replace(/^tamil/, "Tamil").replace(/^ramayana/, "Ramayana");
}

export function surfaceBySlug(slug: string): Surface | undefined {
  return SURFACES.find((s) => s.slug === slug);
}

/** A festival (admin → Festivals) as a landing page, same layout as the others. */
export function festivalSurface(f: Festival, categories: Category[]): Surface {
  const category = f.categoryId ? categories.find((c) => c.id === f.categoryId) : undefined;
  // /christmas-posters and /new-year-posters are poster festivals: their heading says so.
  const kind = f.slug.endsWith("-posters") ? "Posters" : "Stickers";
  return {
    slug: f.slug,
    name: `${f.name} ${kind}`,
    noun: "collection",
    title: f.title || `${f.name} Stickers & Mini Posters`,
    description: f.description || `${f.name} die-cut vinyl stickers for your car, bike and laptop, and mini posters as wall posters or puzzle posters, shipped across India.`,
    intro: f.intro,
    tags: f.tags,
    categories: category ? [category.slug] : [],
    sections: [],
    faq: f.faq,
    when: festivalLongDate(f),
    // a poster festival lists its posters and wall sets, not stickers
    posters: kind === "Posters" || undefined,
  };
}

/** Every landing page: where-it-goes pages plus one per visible festival (festival addresses never shadow them). */
export function allLandings(festivals: Festival[], categories: Category[]): Surface[] {
  const taken = new Set([...SURFACES, ...POSTER_SURFACES].map((s) => s.slug));
  return [
    ...SURFACES,
    ...POSTER_SURFACES,
    ...festivals.filter((f) => f.visible && !taken.has(f.slug)).map((f) => festivalSurface(f, categories)),
  ];
}

/**
 * Stickers for a surface: tagged or categorised for it first (newest first),
 * then — so a page is never thin — every other sticker, since vinyl works on
 * all of these surfaces.
 */
export function stickersForSurface(
  surface: Surface,
  products: Product[],
  categories: Category[]
): { matched: Product[]; others: Product[] } {
  const catIds = new Set(categories.filter((c) => surface.categories.includes(c.slug)).map((c) => c.id));
  const tags = new Set(surface.tags);
  const fits = (p: Product) =>
    p.tags.some((t) => tags.has(t.toLowerCase())) || (p.categoryIds ?? []).some((id) => catIds.has(id));
  if (surface.puzzle) return { matched: products.filter(isSinglePoster), others: [] };
  if (surface.posters) return { matched: postersForSurface(products, fits), others: [] };
  // Sticker pages (car, bike, laptop, festivals…) list stickers only: mini
  // posters are paper and share tags like "car", but don't go on a car.
  const stickers = products.filter((p) => !isPoster(p));
  const matched = stickers.filter(fits);
  // a subject page (Ramayana stickers) lists only its own stickers
  const others = surface.alsoPosters ? [] : stickers.filter((p) => !fits(p));
  return { matched, others };
}

/** A poster page's own stickers (Surface.stickers): stickers with one of its tags or categories. */
export function surfaceStickers(surface: Surface, products: Product[], categories: Category[]): Product[] {
  if (!surface.stickers) return [];
  const catIds = new Set(categories.filter((c) => surface.categories.includes(c.slug)).map((c) => c.id));
  const tags = new Set(surface.tags);
  return products.filter(
    (p) => !isPoster(p) && (p.tags.some((t) => tags.has(t.toLowerCase())) || (p.categoryIds ?? []).some((id) => catIds.has(id)))
  );
}

/** A sticker page's matching posters and wall sets (Surface.alsoPosters), wall sets first. */
export function surfacePosters(surface: Surface, products: Product[], categories: Category[]): Product[] {
  if (!surface.alsoPosters) return [];
  return stickersForSurface({ ...surface, posters: true }, products, categories).matched;
}

/** Wall sets first, then single posters. A set counts when at least half its posters fit (Legends walls have no subject of their own). */
function postersForSurface(products: Product[], fits: (p: Product) => boolean): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const inSet = (set: Product) => {
    const posters = set.packItems.flatMap((id) => byId.get(id) ?? []);
    return posters.filter(fits).length * 2 >= posters.length && posters.length > 0;
  };
  const listed = products.filter((p) => isPoster(p) && isListed(p) && (fits(p) || (isPosterPack(p) && inSet(p))));
  return [...listed.filter(isPosterPack), ...listed.filter((p) => !isPosterPack(p))];
}
