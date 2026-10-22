"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A Link that loads its page only when the shopper shows intent (mouse over,
 * keyboard focus, or finger down) instead of for every link scrolled into
 * view. Pages with dozens of sticker cards stay light on Worker requests, and
 * the tap still opens instantly because the page is fetched a beat earlier.
 */
export default function HoverLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const href = typeof props.href === "string" ? props.href : null;
  const warm = () => {
    if (href) router.prefetch(href);
  };
  return (
    <Link
      {...props}
      prefetch={false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
    />
  );
}
