import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description:
    "Questions about an order, bulk or custom stickers? Email the StickyPie team at hello@clodot.com.",
  path: "/contact",
});

// STORE OWNER: keep these genuine — Cashfree's production review checks the
// contact page.
const CONTACT = {
  email: "hello@clodot.com",
  address: "StickyPie, Bengaluru, Karnataka, India",
  hours: "Mon–Sat, 10:00 AM – 6:00 PM IST",
};

export default function ContactPage() {
  return (
    <div className="mx-auto min-h-screen max-w-[760px] px-4 pt-28 pb-24 sm:px-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-fog">
        Questions about an order, bulk purchases, or custom sticker printing? We&apos;d love to
        hear from you.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:${CONTACT.email}`}
          className="rounded-2xl border border-line bg-ink2 p-5 transition-colors hover:border-fog/40 sm:col-span-2"
        >
          <Mail className="size-6 text-brand" />
          <p className="mt-3 text-sm font-semibold">Email</p>
          <p className="mt-1 text-sm text-fog">{CONTACT.email}</p>
        </a>
        <div className="rounded-2xl border border-line bg-ink2 p-5">
          <MapPin className="size-6 text-brand" />
          <p className="mt-3 text-sm font-semibold">Registered address</p>
          <p className="mt-1 text-sm text-fog">{CONTACT.address}</p>
        </div>
        <div className="rounded-2xl border border-line bg-ink2 p-5">
          <Clock className="size-6 text-brand" />
          <p className="mt-3 text-sm font-semibold">Support hours</p>
          <p className="mt-1 text-sm text-fog">{CONTACT.hours}</p>
        </div>
      </div>

      <p className="mt-8 text-xs text-fog/70">
        For order issues, include your order number (looks like SP-XXXXXXXX) so we can help
        faster.
      </p>
    </div>
  );
}
