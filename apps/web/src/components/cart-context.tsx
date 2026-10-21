"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  qty: number;
  /** null = untracked inventory */
  stock: number | null;
};

export type CartProduct = Omit<CartItem, "qty">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (product: CartProduct, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "stickypie.cart.v1";

function clampQty(qty: number, stock: number | null): number {
  const max = stock === null ? 99 : Math.min(stock, 99);
  return Math.max(1, Math.min(qty, Math.max(max, 1)));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const firstPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
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

  const add = useCallback((product: CartProduct, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.productId
            ? { ...item, ...product, qty: clampQty(item.qty + qty, product.stock) }
            : item
        );
      }
      return [...prev, { ...product, qty: clampQty(qty, product.stock) }];
    });
    // Don't open the drawer — the persistent cart rail/strip picks it up so
    // browsing continues uninterrupted.
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qty: clampQty(qty, item.stock) } : item
      )
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
