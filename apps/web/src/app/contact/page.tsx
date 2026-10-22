import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";
import { SUPPORT_EMAIL } from "@stickypie/shared";
import ContactForm from "@/components/contact-form";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Questions about an order, bulk or custom stickers? Email the StickyPie team at ${SUPPORT_EMAIL}.`,
  path: "/contact",
});

// STORE OWNER: keep these genuine — the payment gateways' production review checks the
// contact page.
const CONTACT = {
  email: SUPPORT_EMAIL,
  address: "StickyPie, Bengaluru, Karnataka, India",
  hours: "Mon–Sat, 10:00 AM – 6:00 PM IST",
};

export default function ContactPage() {
  const rows = [
    { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { icon: Clock, label: "Support hours", value: CONTACT.hours },
    { icon: MapPin, label: "Registered address", value: CONTACT.address },
  ];
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-[84px] pb-10 sm:px-8 lg:pt-28">
      <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-8">
        <aside className="lg:sticky lg:top-28">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Contact us</h1>
          <p className="mt-0.5 text-sm text-fog">Bulk, custom or order help — we reply in 1–2 days.</p>
          {/* Phones: one compact line of details */}
          <div className="mt-2.5 flex flex-wrap gap-1.5 lg:hidden">
            <a
              href={`mailto:${CONTACT.email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-2.5 py-1 text-xs font-medium"
            >
              <Mail className="size-3.5 text-brand" /> {CONTACT.email}
            </a>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-2.5 py-1 text-xs text-fog">
              <Clock className="size-3.5 text-brand" /> Mon–Sat 10–6
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink2 px-2.5 py-1 text-xs text-fog">
              <MapPin className="size-3.5 text-brand" /> Bengaluru
            </span>
          </div>
          <ul className="mt-5 hidden divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink2 lg:block">
            {rows.map(({ icon: Icon, label, value, href }) => {
              const body = (
                <>
                  <Icon className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-semibold tracking-wider text-fog uppercase">
                      {label}
                    </span>
                    <span className="block truncate text-sm text-snow">{value}</span>
                  </span>
                </>
              );
              return (
                <li key={label}>
                  {href ? (
                    <a href={href} className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-ink">
                      {body}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-3.5 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <ContactForm />
      </div>
    </div>
  );
}
