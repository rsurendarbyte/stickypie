import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/site";

type LegalDoc = {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
};

// NOTE FOR THE STORE OWNER: these are starter templates. Review and customize
// them (business name, address, timelines) before going live — Cashfree's
// production approval checks that these pages exist and look genuine.
const DOCS: Record<string, LegalDoc> = {
  terms: {
    title: "Terms & Conditions",
    intro:
      "Welcome to StickyPie. By placing an order on this website you agree to the terms below.",
    sections: [
      {
        heading: "Products & pricing",
        body: [
          "All prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise.",
          "Product images are for illustration; printed colours may vary slightly between batches and screens.",
          "We may change prices, run offers, or discontinue products at any time without notice. Orders already paid for are always honoured at the price paid.",
        ],
      },
      {
        heading: "Orders & payment",
        body: [
          "Payments are processed securely by Cashfree Payments (UPI, cards, netbanking and wallets). StickyPie never stores your card or banking details.",
          "An order is confirmed only after the payment is successfully captured. If money is debited but the order shows as failed, the amount is automatically refunded by the payment network, typically within 5–7 business days.",
        ],
      },
      {
        heading: "Usage",
        body: [
          "Sticker designs sold here are for personal use. Reselling or mass reproduction of the artwork without written permission is not allowed.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "Questions about these terms? Reach us via the Contact page and we'll get back within 1–2 business days.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "We collect the minimum information needed to deliver stickers to your door.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Order details: your name, email, phone number and delivery address — used to process and ship your order, and to contact you about it.",
          "Payment details are handled entirely by Cashfree Payments on their secure pages. We only receive a payment reference, never your card or bank credentials.",
        ],
      },
      {
        heading: "What we don't do",
        body: [
          "We don't sell or rent your personal information to anyone.",
          "We don't send marketing messages without your consent.",
        ],
      },
      {
        heading: "Data retention & removal",
        body: [
          "Order records are kept for accounting and warranty purposes. To have your personal data removed, contact us from the email used on the order and we'll take care of it.",
        ],
      },
    ],
  },
  refunds: {
    title: "Refunds & Cancellations",
    intro: "Simple and fair: if something's wrong with your order, we'll make it right.",
    sections: [
      {
        heading: "Cancellations",
        body: [
          "You can request a cancellation any time before the order is shipped by contacting us with your order number. Paid, unshipped orders are refunded in full.",
        ],
      },
      {
        heading: "Damaged or wrong items",
        body: [
          "If your stickers arrive damaged, misprinted, or incorrect, send us a photo within 7 days of delivery. We'll replace them free of charge or issue a full refund — your choice.",
        ],
      },
      {
        heading: "Refund timelines",
        body: [
          "Approved refunds are initiated within 2 business days to the original payment method via Cashfree. Depending on your bank, the amount reflects in 5–7 business days.",
        ],
      },
      {
        heading: "Failed payments",
        body: [
          "If a payment fails but money was debited, it is auto-reversed by the payment network, usually within 5–7 business days. If it takes longer, contact us with the payment reference.",
        ],
      },
    ],
  },
  shipping: {
    title: "Shipping Policy",
    intro: "Stickers ship across India in sturdy, bend-proof packaging.",
    sections: [
      {
        heading: "Timelines",
        body: [
          "Orders are packed and dispatched within 2–4 business days.",
          "Delivery typically takes 3–7 business days depending on your location. You'll receive tracking details once the order ships.",
        ],
      },
      {
        heading: "Charges",
        body: [
          "Shipping is a flat ₹49, and FREE for orders of ₹499 or more.",
        ],
      },
      {
        heading: "Address issues",
        body: [
          "Please double-check your address and phone number at checkout. If a package returns to us due to an incorrect address, we'll contact you to arrange reshipment.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) return { title: "Legal" };
  return pageMetadata({ title: doc.title, description: doc.intro, path: `/legal/${slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-[760px] px-4 pt-28 pb-24 sm:px-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>
      <p className="mt-3 text-fog">{doc.intro}</p>
      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-fog">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-12 text-xs text-fog/60">Last updated: October 2026</p>
    </div>
  );
}
