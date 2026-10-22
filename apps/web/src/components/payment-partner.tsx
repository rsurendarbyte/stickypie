"use client";

import { PAYMENT_GATEWAY_LABELS } from "@stickypie/shared";
import { useStoreSettings } from "@/lib/live-catalog";

/**
 * Name of the payment gateway switched on in admin → Settings, or null while
 * settings are still loading (so the wrong name never flashes up).
 */
export function usePaymentPartner(): string | null {
  const settings = useStoreSettings();
  return settings.loaded ? PAYMENT_GATEWAY_LABELS[settings.paymentGateway] : null;
}

/** Footer line: "UPI · Cards · NetBanking — secure payments via Razorpay." */
export function PaymentPartnerNote() {
  const partner = usePaymentPartner();
  return (
    <>
      UPI · Cards · NetBanking — secure payments{partner ? ` via ${partner}` : ""}.
    </>
  );
}
