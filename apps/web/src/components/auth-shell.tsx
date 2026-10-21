import { History, Truck, Zap } from "lucide-react";

// Stickers that ship with the storefront (public/stickers), so the panel never
// depends on the live catalog.
const FLOATING = [
  { src: "/stickers/mountain-road-drive.png", className: "top-0 left-[6%] w-[40%] -rotate-6" },
  { src: "/stickers/made-in-india.png", className: "top-[18%] right-[2%] w-[48%] rotate-6 [animation-delay:-2s]" },
  { src: "/stickers/turbo-snail.png", className: "bottom-0 left-[18%] w-[56%] -rotate-2 [animation-delay:-4s]" },
];

const PERKS = [
  { icon: Zap, text: "One-click checkout next time" },
  { icon: Truck, text: "Live tracking from packing to doorstep" },
  { icon: History, text: "Every order in one place" },
];

/** Two-panel layout for sign in, sign up and password reset. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 pt-20 pb-16 sm:px-8 sm:pt-24">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border border-line bg-ink shadow-[0_30px_80px_-30px_rgba(16,24,40,0.3)] lg:min-h-[580px] lg:grid-cols-[1fr_1.05fr]">
        {/* Brand panel — a short banner on phones, a full column on desktop */}
        <div className="pie-gradient relative flex flex-col overflow-hidden px-6 py-7 text-white sm:px-10 lg:py-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-white/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-28 size-80 rounded-full bg-black/10 blur-3xl" />

          <div className="relative">
            <p className="font-display text-3xl leading-tight font-bold sm:text-4xl">
              Stick your style.
            </p>
            <p className="mt-2 max-w-xs text-sm text-white/85">
              Your StickyPie account keeps checkout quick and every order easy to follow.
            </p>
            <ul className="mt-5 hidden space-y-2.5 sm:block lg:mt-8">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/20 backdrop-blur">
                    <Icon className="size-3.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Sticker collage gets its own space below the text */}
          <div aria-hidden className="pointer-events-none relative mt-8 hidden min-h-[220px] flex-1 lg:block">
            {FLOATING.map((s) => (
              <img
                key={s.src}
                src={s.src}
                alt=""
                className={`absolute animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,0.28)] ${s.className}`}
              />
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="flex items-center px-6 py-8 sm:px-10 lg:px-12 lg:py-12">{children}</div>
      </div>
    </div>
  );
}
