"use client";

import { trackMeta } from "@/lib/meta-pixel";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CustomKind, CustomSpec } from "@stickypie/shared";

export type CartItem = {
  productId: string;
  /** Chosen size in inches (longest side); null for single-size stickers. */
  size: number | null;
  /** Shown under the name, e.g. "6″ · 6 × 3.1 in". */
  sizeLabel: string | null;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  /** Small card image for cart lists (falls back to imageUrl). */
  thumbUrl?: string | null;
  qty: number;
  /** null = untracked inventory */
  stock: number | null;
  /** Custom sticker (artwork uploaded after payment). */
  custom?: boolean;
  /** Custom sticker: links to the artwork kept in this browser until paid. */
  customRef?: string;
  /** Custom sticker kind: an uploaded design, or a QR / name sticker made on the site. */
  customKind?: CustomKind;
  /** QR / name stickers: what to draw (no image is uploaded for these). */
  customSpec?: CustomSpec;
};

export type CartProduct = Omit<CartItem, "qty">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Adds to the cart (custom and regular stickers can share one order). Returns true once added. */
  add: (product: CartProduct, qty?: number) => boolean;
  /** Lines are keyed by product + size — see lineKey(). */
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "stickypie.cart.v1";

/** Where a cart line links to: the sticker page, or the custom sticker page. */
export function itemHref(item: { slug: string; custom?: boolean; customKind?: CustomKind }): string {
  if (!item.custom) return `/sticker/${item.slug}`;
  if (item.customKind === "qr") return "/qr-code-stickers";
  if (item.customKind === "text") return "/name-stickers";
  if (item.customKind === "avatar") return "/avatar-stickers";
  return "/custom-stickers/design";
}

/** One cart line per sticker per size. */
export function lineKey(item: { productId: string; size?: number | null }): string {
  return `${item.productId}:${item.size ?? ""}`;
}

function clampQty(qty: number, stock: number | null): number {
  const max = stock === null ? 99 : Math.min(stock, 99);
  return Math.max(1, Math.min(qty, Math.max(max, 1)));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const firstPersist = useRef(true);
  // A product waiting on "start a new order?" (custom vs regular cart).

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Carts saved before sizes existed have no size fields.
        const saved = JSON.parse(raw) as Array<Partial<CartItem> & { productId: string }>;
        setItems(
          saved.map((item) => ({ ...item, size: item.size ?? null, sizeLabel: item.sizeLabel ?? null }) as CartItem)
        );
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    // Never write on the initial render — the empty state would clobber the
    // saved cart before hydration applies (StrictMode remounts made this real).
    if (firstPersist.current) {
      firstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage may be unavailable; cart still works in memory
    }
  }, [items]);

  const put = useCallback((product: CartProduct, qty: number) => {
    setItems((prev) => {
      const key = lineKey(product);
      // Stock is shared by every size of a sticker.
      const otherSizes = prev
        .filter((item) => item.productId === product.productId && lineKey(item) !== key)
        .reduce((sum, item) => sum + item.qty, 0);
      const stock = product.stock === null ? null : Math.max(product.stock - otherSizes, 0);
      if (stock === 0) return prev;
      const existing = prev.find((item) => lineKey(item) === key);
      if (existing) {
        return prev.map((item) =>
          lineKey(item) === key
            ? { ...item, ...product, qty: clampQty(item.qty + qty, stock) }
            : item
        );
      }
      return [...prev, { ...product, qty: clampQty(qty, stock) }];
    });
  }, []);

  const add = useCallback(
    (product: CartProduct, qty = 1) => {
      put(product, qty);
      trackMeta("AddToCart", {
        content_ids: [product.productId],
        content_name: product.name,
        content_type: "product",
        value: product.price * qty,
        currency: "INR",
      });
      // Don't open the drawer — the persistent cart rail/strip picks it up so
      // browsing continues uninterrupted.
      return true;
    },
    [put]
  );

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => {
      const target = prev.find((item) => lineKey(item) === key);
      if (!target) return prev;
      const otherSizes = prev
        .filter((item) => item.productId === target.productId && lineKey(item) !== key)
        .reduce((sum, item) => sum + item.qty, 0);
      const stock = target.stock === null ? null : Math.max(target.stock - otherSizes, 1);
      return prev.map((item) =>
        lineKey(item) === key ? { ...item, qty: clampQty(qty, stock) } : item
      );
    });
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => lineKey(item) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    return {
      items,
      count,
      subtotal,
      isOpen,
      openCart,
      closeCart,
      add,
      setQty,
      remove,
      clear,
    };
  }, [items, isOpen, openCart, closeCart, add, setQty, remove, clear]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
