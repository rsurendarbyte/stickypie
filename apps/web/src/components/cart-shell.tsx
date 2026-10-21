"use client";

import { usePathname } from "next/navigation";
import { useCart } from "./cart-context";
import CartStrip, { cartUiHidden } from "./cart-strip";

/**
 * Wraps the page so the persistent bottom cart strip gets real space —
 * content gains bottom padding whenever the strip is showing.
 */
export default function CartShell({ children }: { children: React.ReactNode }) {
  const { count } = useCart();
  const pathname = usePathname();
  const active = count > 0 && !cartUiHidden(pathname);

  return (
    <>
      <div
        className={
          active
            ? "pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
            : ""
        }
      >
        {children}
      </div>
      <CartStrip />
    </>
  );
}
