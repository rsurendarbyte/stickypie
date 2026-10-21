import Link from "next/link";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Shop",
    links: [
      { label: "Browse all", href: "/browse" },
      { label: "New drops", href: "/browse?sort=new" },
    ],
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
      <div className="grid w-full gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-12 2xl:px-20">
        <div>
          <p className="font-display text-2xl font-semibold">
            Sticky<span className="text-pie">Pie</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-fog">
            Stick your style. Premium die-cut vinyl stickers for rides, lids, laptops and
            everything in between.
          </p>
          <p className="mt-4 text-xs text-fog/70">
            UPI · Cards · NetBanking — payments secured by Cashfree.
          </p>
          {demoMode && (
            <p className="mt-3 inline-block rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">
              Local demo mode — set Supabase &amp; Cashfree keys to go live
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
        © {new Date().getFullYear()} StickyPie · Made with 🥧 in India
      </div>
    </footer>
  );
}
