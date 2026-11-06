import Link from "@/components/page-link";
import { PaymentPartnerNote } from "./payment-partner";
import { POSTER_SURFACES, SURFACES } from "@/lib/surfaces";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Shop",
    links: [
      { label: "Wall poster sets", href: "/stickers/poster-packs" },
      { label: "All stickers", href: "/stickers" },
      { label: "New drops", href: "/stickers?sort=new" },
      { label: "Custom stickers", href: "/custom-stickers" },
      { label: "QR code stickers", href: "/qr-code-stickers" },
      { label: "Name stickers", href: "/name-stickers" },
      ...SURFACES.map((s) => ({ label: s.name, href: `/${s.slug}` })),
    ],
  },
  {
    title: "Wall posters",
    links: POSTER_SURFACES.map((s) => ({ label: s.name, href: `/${s.slug}` })),
  },
  {
    title: "Support",
    links: [
      { label: "Contact us", href: "/contact" },
      { label: "Shipping policy", href: "/legal/shipping" },
      { label: "Refunds & cancellations", href: "/legal/refunds" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms & conditions", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
    ],
  },
];

export default function Footer({ demoMode }: { demoMode: boolean }) {
  return (
    <footer className="border-t border-line bg-ink2">
      <div className="grid w-full gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-12 2xl:px-20">
        <div>
          <img loading="lazy" decoding="async"
            src="/icons/logo-wide.webp"
            alt="StickyPie"
            width={960}
            height={323}
            className="h-16 w-auto drop-shadow-[0_1px_2px_rgba(21,22,30,0.2)]"
          />
          <p className="mt-2 max-w-xs text-sm text-fog">
            Stick your style. Premium die-cut vinyl stickers for rides, lids and laptops,
            and wall posters for everywhere in between.
          </p>
          <p className="mt-4 text-xs text-fog/70">
            <PaymentPartnerNote />
          </p>
          {demoMode && (
            <p className="mt-3 inline-block rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">
              Local demo mode — set Supabase &amp; payment gateway keys to go live
            </p>
          )}
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-snow/90">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-fog transition-colors hover:text-snow"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/60 py-5 text-center text-xs text-fog/60">
        © {new Date().getFullYear()} StickyPie · Stickers printed in India
      </div>
    </footer>
  );
}
