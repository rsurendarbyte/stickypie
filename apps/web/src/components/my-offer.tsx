"use client";

import Link from "@/components/page-link";
import { useEffect, useState } from "react";
import { Gift, ShoppingBag } from "lucide-react";
import type { MyOffer } from "@/app/api/offers/route";
import { useShopper } from "@/lib/shopper-auth";

/** The signed-in shopper's thank-you offer (approved by the shop), or null. */
export function useMyOffer(): MyOffer {
  const shopper = useShopper();
  const token = shopper.session?.access_token ?? null;
  const [offer, setOffer] = useState<MyOffer>(null);
  useEffect(() => {
    if (!token) {
      setOffer(null);
      return;
    }
    let live = true;
    fetch("/api/offers", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MyOffer) => live && setOffer(data && typeof data.percent === "number" ? data : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);
  return offer;
}

function until(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Account page: "You have X% off your next order" once the shop has approved it. */
export default function OfferCard() {
  const offer = useMyOffer();
  if (!offer) return null;
  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5 p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        <span className="pie-gradient grid size-14 shrink-0 -rotate-6 place-items-center rounded-full text-white shadow-md shadow-brand/25">
          <span className="text-center leading-none">
            <span className="block font-display text-lg font-bold">{offer.percent}%</span>
            <span className="block text-[10px] font-bold uppercase">off</span>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-lg leading-tight font-bold">
            <Gift className="size-4 shrink-0 text-brand" /> You have {offer.percent}% off your next order
          </p>
          <p className="mt-0.5 text-xs text-fog">
            Thanks for your feedback! It&apos;s taken off the stickers at checkout by itself, for one order, until{" "}
            {until(offer.expiresAt)}.
          </p>
        </div>
      </div>
      <Link
        href="/stickers"
        className="peel-btn mt-3.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold sm:w-auto sm:px-6"
      >
        <ShoppingBag className="peel-icon size-4" /> Use it now
      </Link>
    </div>
  );
}
