import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORT_EMAIL } from "@stickypie/shared";
import { getDriver } from "@/lib/data";
import { pageMetadata } from "@/lib/site";

async function business(): Promise<Business> {
  try {
    const { business, paymentGateway } = await getDriver().getSettings();
    return {
      name: business.name || "StickyPie",
      address: business.address,
      gstin: business.gstin,
      payments: GATEWAY_NAMES[paymentGateway],
    };
  } catch {
    return { name: "StickyPie", address: null, gstin: null, payments: "our payment partner" };
  }
}

type LegalDoc = {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string[] }>;
};

type Business = { name: string; address: string | null; gstin: string | null; payments: string };

const GATEWAY_NAMES = { razorpay: "Razorpay", cashfree: "Cashfree Payments" } as const;

// The payment gateways' approval checks that these pages exist, match what the
// shop really does, and name the business behind it — the seller name,
// address and GSTIN come from admin → Settings → Business & GST invoice.
function docs(biz: Business): Record<string, LegalDoc> {
  const operator = `${biz.name}${biz.address ? `, ${biz.address}` : ""}${biz.gstin ? ` (GSTIN ${biz.gstin})` : ""}`;
  const contact = `Contact page or email ${SUPPORT_EMAIL}`;
  return {
    terms: {
      title: "Terms & Conditions",
      intro: `These terms apply to every order placed on stickypie.in. StickyPie is operated by ${operator}. By creating an account or placing an order you agree to them.`,
      sections: [
        {
          heading: "Your account",
          body: [
            "You need an account to place an order. Please give accurate details, keep your password private, and tell us if you notice any unauthorised use.",
            "You must be 18 or older, or use the site with the involvement of a parent or guardian.",
          ],
        },
        {
          heading: "Products",
          body: [
            "Our stickers are printed on waterproof vinyl and die-cut to shape.",
            "Sticker sizes are measured on the longest side; the other side follows the shape of the design, as shown in the size details on each product page.",
            "The “actual size” preview is a guide — how big it looks depends on your screen. Printed colours may vary slightly from what you see on screen.",
          ],
        },
        {
          heading: "Prices",
          body: [
            "All prices are in Indian Rupees (INR) and shown before GST. GST at the applicable rate is added on the stickers and shipping at checkout, and shown before you pay.",
            "Shipping is charged on every order based on the delivery distance and is shown at checkout before you pay. A minimum order value applies.",
            "Prices and offers can change at any time; an order is always charged at the price shown when you paid.",
          ],
        },
        {
          heading: "Orders & payment",
          body: [
            `All orders are prepaid — UPI, cards, netbanking or wallets through our payment partner, ${biz.payments}. We don't offer cash on delivery. We never see or store your card or bank details.`,
            "An order is confirmed only after the payment is captured. An unfinished checkout can be paid from the order page for 30 minutes; after that, please check out again.",
            "We may cancel an order — for example if an item becomes unavailable, a price was shown in error, or the payment looks fraudulent. You then get a full refund to the original payment method.",
            "A GST tax invoice for each order can be downloaded from the order page once it is delivered.",
          ],
        },
        {
          heading: "Reviews",
          body: [
            "After delivery you can review your order and add one photo. Reviews are checked before they are published and may be declined or removed if they are offensive, irrelevant or not about the product.",
            "By posting a review you allow us to show it, including the photo, on this website.",
          ],
        },
        {
          heading: "Designs & trademarks",
          body: [
            "Our original designs remain our property. Stickers are sold for personal use; please don't resell or reproduce the artwork without written permission.",
            "Brand names and logos that appear in some designs belong to their owners. StickyPie is not affiliated with or endorsed by them.",
          ],
        },
        {
          heading: "Using stickers",
          body: [
            "Apply stickers to clean, dry surfaces. We are not responsible for marks or damage to a surface when a sticker is removed.",
            "On vehicles, follow local traffic rules — don't cover number plates, lights, or the driver's view.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "Our liability for any order is limited to the amount paid for that order. Damaged or wrong items are handled as described in our Refunds & Cancellations policy.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "These terms are governed by the laws of India. Any dispute is subject to the courts at the place of our registered office.",
            "We may update these terms from time to time; the version on this page applies to new orders.",
          ],
        },
        { heading: "Contact", body: [`Questions about these terms? Reach us via the ${contact}.`] },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      intro: `This policy explains what personal data StickyPie (operated by ${operator}) collects, why, and the choices you have. We collect only what we need to deliver your stickers.`,
      sections: [
        {
          heading: "What we collect",
          body: [
            "Account: your name, email address and password. Passwords are stored by our sign-in provider in encrypted (hashed) form — we can never read them.",
            "Orders: your phone number, delivery addresses (including any you save for later), the items you order and the order history.",
            "Payments: a payment reference and status from our payment partner. Card, UPI and bank details are entered on the payment partner's secure window and never reach us.",
            "Messages and reviews: anything you send through the contact form, and reviews with any photo you add.",
            "On your device: your cart, saved preferences and a copy of the catalogue (to make pages load faster) are kept in your browser's local storage. We don't use advertising or tracking cookies.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To process, pack, ship and track your orders, and to send order and shipping updates by email.",
            "To issue GST invoices, keep accounts and meet legal and tax requirements.",
            "To answer your questions and resolve problems with an order.",
            "To prevent fraud and keep the site secure.",
            "We don't send marketing messages unless you ask for them.",
          ],
        },
        {
          heading: "Who we share it with",
          body: [
            `Our payment partner (${biz.payments}) — to take your payment.`,
            "Shipping partners (Shiprocket and the courier companies it works with) — your name, phone number and address, so they can deliver your parcel.",
            "Service providers that run the shop for us: website hosting (Cloudflare), database and sign-in (Supabase) and email delivery (Resend). They process data only on our instructions.",
            "Authorities, when the law requires it. We never sell or rent your personal data.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "Order and invoice records are kept for as long as Indian tax law requires (generally at least 6 years).",
            "Your account and saved addresses are kept until you ask us to delete them. Contact messages and reviews are kept until they are no longer needed or you ask us to remove them.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Under India's Digital Personal Data Protection Act, 2023 you can ask to see, correct or delete your personal data, withdraw consent, and raise a grievance. Saved addresses can be edited or deleted any time from your account.",
            `To make a request, contact us from the email linked to your account via the ${contact}. We respond within 7 business days.`,
          ],
        },
        {
          heading: "Security",
          body: [
            "Data is sent over encrypted connections (HTTPS) and access to it is restricted to people who need it to run the shop.",
          ],
        },
        {
          heading: "Changes",
          body: ["If we change this policy, the updated version will be posted on this page with a new date."],
        },
      ],
    },
    refunds: {
      title: "Refunds & Cancellations",
      intro: "Every sticker is printed for your order. If something arrives damaged or wrong, we'll replace it free of charge.",
      sections: [
        {
          heading: "Cancellations",
          body: [
            "Because stickers are printed and packed to order, an order can't be cancelled by you once the payment is confirmed.",
            "An unpaid checkout is not an order — if you closed the payment window or the payment failed, no money was taken and nothing needs cancelling.",
            "If we have to cancel an order (for example, an item is unavailable), you get a full refund to the original payment method.",
          ],
        },
        {
          heading: "Damaged, misprinted or wrong items",
          body: [
            "If your stickers arrive damaged, misprinted, or not what you ordered, contact us within 7 days of delivery with your order number (SP-XXXXXXXX) and a photo of the item and packaging.",
            "Once confirmed, we send a replacement free of charge, including shipping. Damaged or wrong items are replaced, not refunded. You don't need to send the item back unless we ask.",
          ],
        },
        {
          heading: "Not covered",
          body: [
            "Change of mind, or a size that turned out bigger or smaller than expected — please check the size details and the “actual size” preview before ordering.",
            "Small colour differences between your screen and the printed sticker.",
            "Damage caused while applying or removing a sticker.",
            "Parcels that can't be delivered because of an incorrect address or phone number given at checkout (see our Shipping Policy).",
          ],
        },
        {
          heading: "Duplicate or failed payments",
          body: [
            "If you are charged twice for the same order, the extra payment is refunded in full.",
            "If money was debited but the order didn't go through, the bank or payment network reverses it automatically, usually within 5–7 business days. If it takes longer, contact us with the payment reference.",
          ],
        },
        {
          heading: "Refund timelines",
          body: [
            `Approved refunds are started within 2 business days, back to the original payment method through ${biz.payments}. Depending on your bank, the amount shows up within 5–7 business days.`,
          ],
        },
        { heading: "Contact", body: [`For any order issue, reach us via the ${contact} with your order number.`] },
      ],
    },
    shipping: {
      title: "Shipping Policy",
      intro: "We ship across India in sturdy, bend-proof packaging, with tracking on every order.",
      sections: [
        {
          heading: "Where we ship",
          body: [
            "We deliver to PIN codes across India served by our courier partners. We don't ship outside India at the moment.",
          ],
        },
        {
          heading: "Processing & delivery time",
          body: [
            "Orders are printed, packed and handed to the courier within 2–4 business days of payment.",
            "Delivery usually takes 3–5 business days after dispatch, and can take longer for remote areas, during festivals or in bad weather.",
          ],
        },
        {
          heading: "Shipping charges",
          body: [
            "Shipping is charged on every order based on the distance from our dispatch location — same city, within our state, rest of India, or remote areas (North-East, Jammu & Kashmir, Ladakh and the islands).",
            "The exact charge is shown at checkout as soon as you enter your PIN code, before you pay. A minimum order value applies; the cart shows how much more to add.",
          ],
        },
        {
          heading: "Tracking",
          body: [
            "Orders are shipped through Shiprocket with partner couriers. Once your parcel is picked up you get a tracking link by email, and the order page updates automatically as it moves — shipped, out for delivery, delivered.",
          ],
        },
        {
          heading: "Address & delivery issues",
          body: [
            "Please check your address, PIN code and phone number at checkout — the courier uses your phone number to reach you.",
            "If a parcel comes back to us because the address was wrong or nobody could be reached, we'll contact you to arrange reshipping; the extra shipping charge is payable by you.",
            "If your parcel arrives damaged, please follow the steps in our Refunds & Cancellations policy within 7 days of delivery.",
          ],
        },
        { heading: "Contact", body: [`Questions about a delivery? Reach us via the ${contact} with your order number.`] },
      ],
    },
  };
}

// Built once at deploy and served as free static files (every page's footer
// links here, so rendering per request cost Worker requests). Seller details
// and payment partner come from admin → Settings at build time: redeploy after
// changing them.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(docs({ name: "", address: null, gstin: null, payments: "" })).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs(await business())[slug];
  if (!doc) return { title: "Legal" };
  return pageMetadata({ title: doc.title, description: doc.intro, path: `/legal/${slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = docs(await business())[slug];
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
      <p className="mt-12 text-xs text-fog/60">Last updated: 22 October 2026</p>
    </div>
  );
}
