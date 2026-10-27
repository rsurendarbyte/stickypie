/**
 * Stand-in avatar art, drawn in code: one look per sticker-book style (90s
 * retro, anime, action figure…) so the maker and the home wall have something
 * to show until the admin uploads real sample images. Same person for a given
 * seed; `mood` changes the expression so a page of four looks like a set.
 * Deterministic (no randomness), so server and browser draw the same thing.
 */

type Look =
  | "retro"
  | "anime"
  | "figure"
  | "toon3d"
  | "chibi"
  | "comic"
  | "pixel"
  | "clay"
  | "bollywood"
  | "hero"
  | "y2k"
  | "sketch"
  | "plain";

function lookFor(style: string): Look {
  const s = style.toLowerCase();
  if (s.includes("retro") || s.includes("90")) return "retro";
  if (s.includes("anime")) return "anime";
  if (s.includes("action") || s.includes("figure") || s.includes("toy box")) return "figure";
  if (s.includes("3d")) return "toon3d";
  if (s.includes("chibi")) return "chibi";
  if (s.includes("comic")) return "comic";
  if (s.includes("pixel")) return "pixel";
  if (s.includes("clay")) return "clay";
  if (s.includes("bollywood") || s.includes("poster")) return "bollywood";
  if (s.includes("super") || s.includes("hero")) return "hero";
  if (s.includes("y2k")) return "y2k";
  if (s.includes("sketch") || s.includes("pencil")) return "sketch";
  return "plain";
}

/** Small stable hash, so each style (or seed text) gets its own person. */
export function avatarSeed(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const SKINS = ["#f3cba5", "#e3ab80", "#c98d62", "#9a6342"];
const HAIRS = ["#2a1b14", "#4b2e1e", "#141414", "#7b4a26"];

const BG: Record<Look, [string, string]> = {
  retro: ["#ff7eb6", "#4fd1c5"],
  anime: ["#c7d2fe", "#fbcfe8"],
  figure: ["#1e3a8a", "#2563eb"],
  toon3d: ["#bae6fd", "#e0f2fe"],
  chibi: ["#fde68a", "#fbcfe8"],
  comic: ["#fde047", "#facc15"],
  pixel: ["#86efac", "#22c55e"],
  clay: ["#fed7aa", "#fdba74"],
  bollywood: ["#f97316", "#b91c1c"],
  hero: ["#38bdf8", "#1d4ed8"],
  y2k: ["#e9d5ff", "#a5f3fc"],
  sketch: ["#fafaf9", "#f5f5f4"],
  plain: ["#ffe4ec", "#fde68a"],
};

const SHIRT: Record<Look, string> = {
  retro: "#7c3aed",
  anime: "#1f2937",
  figure: "#dc2626",
  toon3d: "#f97316",
  chibi: "#ec4899",
  comic: "#2563eb",
  pixel: "#ef4444",
  clay: "#16a34a",
  bollywood: "#fef3c7",
  hero: "#dc2626",
  y2k: "#f472b6",
  sketch: "none",
  plain: "#e8336d",
};

type Person = { skin: string; hair: string; long: boolean };

function personFor(seed: number): Person {
  return { skin: SKINS[seed % 4], hair: HAIRS[(seed >> 3) % 4], long: ((seed >> 5) & 1) === 1 };
}

/* ---------- Pixel art: the same face sampled on a 20×20 grid ---------- */

function pixelColour(x: number, y: number, p: Person, mood: number, shirt: string): string | null {
  const inEllipse = (cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  // eyes, mouth
  if ((x === 7 || x === 12) && y === 10) return mood === 2 && x === 12 ? p.skin : "#111";
  if (y === 13 && x >= 8 && x <= 11) return "#7f1d1d";
  if (mood === 1 && y === 14 && x >= 9 && x <= 10) return "#7f1d1d";
  if (inEllipse(9.5, 9.5, 5.5, 6) && y <= 5.5) return p.hair;
  if (inEllipse(9.5, 9.5, 5.5, 6)) return p.skin;
  if (p.long && inEllipse(9.5, 10, 6.8, 7.5) && y <= 14) return p.hair;
  if (x >= 8 && x <= 11 && y >= 15 && y <= 16) return p.skin;
  if (inEllipse(9.5, 21, 8.5, 5.5)) return shirt;
  return null;
}

function PixelAvatar({ person, mood }: { person: Person; mood: number }) {
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++) {
      const c = pixelColour(x, y, person, mood, SHIRT.pixel);
      if (c) cells.push(<rect key={`${x}-${y}`} x={x * 6} y={y * 6} width={6.2} height={6.2} fill={c} />);
    }
  return <g shapeRendering="crispEdges">{cells}</g>;
}

/* ---------- Everything else: one vector face, dressed per look ---------- */

export default function AvatarArt({
  style,
  seed = avatarSeed(style),
  mood = 0,
  className,
}: {
  style: string;
  seed?: number;
  /** 0 smile · 1 big grin · 2 wink · 3 wow */
  mood?: number;
  className?: string;
}) {
  const look = lookFor(style);
  const p = personFor(seed);
  const id = `av${seed}-${mood}-${look}`;
  const [bg1, bg2] = BG[look];
  const sketch = look === "sketch";
  const comic = look === "comic";
  const line = comic ? "#111" : sketch ? "#57534e" : "none";
  const lineW = comic ? 2.6 : sketch ? 1.6 : 0;
  const skin = sketch ? "#fafaf9" : p.skin;
  const hair = sketch ? "#d6d3d1" : look === "y2k" ? "#f0abfc" : p.hair;
  const shirt = SHIRT[look];
  const chibi = look === "chibi";
  const head = chibi ? { cx: 60, cy: 54, rx: 32, ry: 31 } : { cx: 60, cy: 56, rx: 25, ry: 28 };
  const eyeY = chibi ? 60 : 58;
  const eyeDX = chibi ? 12 : 10;
  const big = look === "anime" || chibi;

  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`${style} avatar`}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </linearGradient>
        <radialGradient id={`${id}-shade`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity={look === "toon3d" || look === "clay" ? 0.45 : 0} />
          <stop offset="1" stopColor="#000" stopOpacity={look === "toon3d" ? 0.18 : look === "clay" ? 0.1 : 0} />
        </radialGradient>
        <pattern id={`${id}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.3" fill="#f97316" opacity="0.55" />
        </pattern>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5f5f5" />
          <stop offset="0.5" stopColor="#a3a3a3" />
          <stop offset="1" stopColor="#e5e5e5" />
        </linearGradient>
      </defs>

      {/* backdrop */}
      <rect width="120" height="120" fill={`url(#${id}-bg)`} />
      {comic && <rect width="120" height="120" fill={`url(#${id}-dots)`} />}
      {look === "bollywood" &&
        Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M60 60 L${60 + 90 * Math.cos((i * Math.PI) / 6)} ${60 + 90 * Math.sin((i * Math.PI) / 6)} L${60 + 90 * Math.cos(((i + 0.5) * Math.PI) / 6)} ${60 + 90 * Math.sin(((i + 0.5) * Math.PI) / 6)}Z`}
            fill="#fde68a"
            opacity="0.25"
          />
        ))}
      {look === "retro" && (
        <>
          <circle cx="60" cy="64" r="40" fill="#fde047" opacity="0.85" />
          {[70, 78, 86].map((y) => (
            <rect key={y} x="0" y={y} width="120" height="3" fill={bg1} />
          ))}
        </>
      )}
      {look === "y2k" &&
        [
          [18, 22],
          [100, 30],
          [24, 92],
          [96, 86],
        ].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z`}
            fill="#fff"
            opacity="0.9"
          />
        ))}
      {look === "figure" && (
        <>
          <rect x="10" y="8" width="100" height="104" rx="8" fill="#fff" opacity="0.18" />
          <rect x="18" y="20" width="84" height="84" rx="6" fill="#dbeafe" opacity="0.9" />
        </>
      )}
      {look === "pixel" ? (
        <PixelAvatar person={p} mood={mood} />
      ) : (
        <g stroke={line} strokeWidth={lineW} strokeLinejoin="round" strokeLinecap="round">
          {/* cape behind the body */}
          {look === "hero" && <path d="M30 88 L18 120 L102 120 L90 88Z" fill="#facc15" />}
          {/* long hair behind the head */}
          {p.long && (
            <path
              d={`M${head.cx - head.rx - 3} ${head.cy - 6} Q${head.cx - head.rx - 6} ${head.cy + 30} ${head.cx - 18} ${head.cy + 34} L${head.cx + 18} ${head.cy + 34} Q${head.cx + head.rx + 6} ${head.cy + 30} ${head.cx + head.rx + 3} ${head.cy - 6}Z`}
              fill={hair}
            />
          )}
          {/* shoulders + neck */}
          <path
            d={chibi ? "M34 120 Q36 92 60 90 Q84 92 86 120Z" : "M22 120 Q24 92 60 88 Q96 92 98 120Z"}
            fill={sketch ? "#fafaf9" : shirt}
          />
          {look === "hero" && <path d="M60 98 l4 8 h8 l-6 5 2 8 -8 -5 -8 5 2 -8 -6 -5 h8z" fill="#facc15" stroke="none" />}
          {look === "bollywood" && <path d="M44 92 L60 112 L76 92" fill="none" stroke="#b45309" strokeWidth="3" />}
          <rect x="53" y={chibi ? 80 : 78} width="14" height="12" rx="4" fill={skin} />
          {/* head */}
          <ellipse {...head} fill={skin} />
          <ellipse {...head} fill={`url(#${id}-shade)`} stroke="none" />
          {/* ears */}
          <circle cx={head.cx - head.rx + 1} cy={eyeY + 2} r="5" fill={skin} />
          <circle cx={head.cx + head.rx - 1} cy={eyeY + 2} r="5" fill={skin} />
          {/* hair on top */}
          <path
            d={
              look === "anime"
                ? `M${head.cx - head.rx - 2} ${head.cy + 2} L${head.cx - 22} ${head.cy - 22} L${head.cx - 30} ${head.cy - 34} L${head.cx - 10} ${head.cy - 28} L${head.cx - 4} ${head.cy - 40} L${head.cx + 6} ${head.cy - 28} L${head.cx + 24} ${head.cy - 36} L${head.cx + 20} ${head.cy - 20} L${head.cx + head.rx + 2} ${head.cy + 2} Q${head.cx + 16} ${head.cy - 16} ${head.cx + 2} ${head.cy - 12} L${head.cx - 6} ${head.cy - 4} L${head.cx - 10} ${head.cy - 14} Q${head.cx - 20} ${head.cy - 10} ${head.cx - head.rx - 2} ${head.cy + 2}Z`
                : `M${head.cx - head.rx - 1} ${head.cy + 2} Q${head.cx - head.rx - 2} ${head.cy - head.ry - 4} ${head.cx} ${head.cy - head.ry - 3} Q${head.cx + head.rx + 2} ${head.cy - head.ry - 4} ${head.cx + head.rx + 1} ${head.cy + 2} Q${head.cx + 14} ${head.cy - 18} ${head.cx - 4} ${head.cy - 14} Q${head.cx - 18} ${head.cy - 12} ${head.cx - head.rx - 1} ${head.cy + 2}Z`
            }
            fill={hair}
          />
          {look === "y2k" && <rect x={head.cx + 10} y={head.cy - 22} width="10" height="5" rx="2.5" fill="#22d3ee" stroke="none" />}

          {/* eyes */}
          {look === "retro" ? (
            <g stroke="none">
              <rect x={head.cx - 21} y={eyeY - 5} width="17" height="10" rx="4" fill="#111" />
              <rect x={head.cx + 4} y={eyeY - 5} width="17" height="10" rx="4" fill="#111" />
              <rect x={head.cx - 4} y={eyeY - 2} width="8" height="2.5" fill="#111" />
              <rect x={head.cx - 18} y={eyeY - 3} width="5" height="2" rx="1" fill="#fff" opacity="0.7" />
            </g>
          ) : (
            [-1, 1].map((side) => {
              const cx = head.cx + side * eyeDX;
              if (mood === 2 && side === 1)
                return <path key={side} d={`M${cx - 4} ${eyeY} q4 -3 8 0`} fill="none" stroke="#111" strokeWidth="2" />;
              return big ? (
                <g key={side} stroke="none">
                  <ellipse cx={cx} cy={eyeY} rx="4.6" ry={mood === 3 ? 7 : 6} fill="#111" />
                  <ellipse cx={cx} cy={eyeY + 1.5} rx="3" ry="3.5" fill={look === "anime" ? "#7c3aed" : "#78350f"} />
                  <circle cx={cx - 1.5} cy={eyeY - 2.5} r="1.8" fill="#fff" />
                </g>
              ) : (
                <circle key={side} cx={cx} cy={eyeY} r={mood === 3 ? 3.6 : 2.8} fill="#111" stroke="none" />
              );
            })
          )}
          {/* hero mask over the eyes */}
          {look === "hero" && (
            <path
              d={`M${head.cx - 24} ${eyeY - 4} Q${head.cx} ${eyeY - 10} ${head.cx + 24} ${eyeY - 4} L${head.cx + 22} ${eyeY + 5} Q${head.cx} ${eyeY + 2} ${head.cx - 22} ${eyeY + 5}Z`}
              fill="#111"
              stroke="none"
              opacity="0.92"
            />
          )}
          {look === "hero" &&
            [-1, 1].map((s) => <circle key={s} cx={head.cx + s * eyeDX} cy={eyeY} r="2.6" fill="#fff" stroke="none" />)}
          {/* brows */}
          {look !== "retro" &&
            look !== "hero" &&
            [-1, 1].map((s) => (
              <path
                key={s}
                d={`M${head.cx + s * eyeDX - 5} ${eyeY - (big ? 11 : 8)} q5 -3 10 0`}
                fill="none"
                stroke={sketch ? "#57534e" : hair}
                strokeWidth="2"
              />
            ))}
          {/* blush */}
          {(big || look === "clay" || look === "toon3d") &&
            [-1, 1].map((s) => (
              <ellipse key={s} cx={head.cx + s * 15} cy={eyeY + 9} rx="4.5" ry="2.6" fill="#fb7185" opacity="0.45" stroke="none" />
            ))}
          {/* mouth */}
          {mood === 1 ? (
            <path d={`M${head.cx - 9} ${eyeY + 13} Q${head.cx} ${eyeY + 26} ${head.cx + 9} ${eyeY + 13}Z`} fill="#7f1d1d" stroke={line} />
          ) : mood === 3 ? (
            <ellipse cx={head.cx} cy={eyeY + 17} rx="3.6" ry="4.6" fill="#7f1d1d" />
          ) : (
            <path
              d={`M${head.cx - 8} ${eyeY + 14} Q${head.cx} ${eyeY + 21} ${head.cx + 8} ${eyeY + 14}`}
              fill="none"
              stroke={sketch ? "#57534e" : "#7f1d1d"}
              strokeWidth="2.4"
            />
          )}
        </g>
      )}

      {/* style labels drawn into the art */}
      {look === "comic" && (
        <g transform="translate(92 18) rotate(12)">
          <path d="M0 -14 L5 -6 L15 -9 L9 -1 L16 6 L5 6 L2 15 L-3 7 L-14 10 L-8 1 L-15 -6 L-4 -5Z" fill="#ef4444" stroke="#111" strokeWidth="1.5" />
          <text x="0" y="3" textAnchor="middle" fontSize="7" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">
            POW
          </text>
        </g>
      )}
      {look === "figure" && (
        <>
          <rect x="10" y="100" width="100" height="14" rx="3" fill="#facc15" />
          <text x="60" y="110.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#1e3a8a" fontFamily="system-ui, sans-serif">
            ACTION ME
          </text>
        </>
      )}
      {look === "bollywood" && (
        <>
          <rect x="0" y="103" width="120" height="17" fill="#7f1d1d" />
          <text x="60" y="115.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fde68a" fontFamily="Georgia, serif" letterSpacing="1">
            STARRING ME
          </text>
        </>
      )}
    </svg>
  );
}
