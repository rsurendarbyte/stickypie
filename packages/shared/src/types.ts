export type Category = {
  id: string;
  name: string;
  slug: string;
  sort: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Price in whole INR (₹). */
  price: number;
  /** Strike-through price in whole INR, for sales. */
  compareAtPrice: number | null;
  categoryId: string | null;
  imageUrl: string;
  /** Small WebP for cards (made by the admin); null → use imageUrl. */
  thumbUrl: string | null;
  tags: string[];
  featured: boolean;
  /** Shows the "NEW" badge on the storefront (set by hand in the admin). */
  isNew: boolean;
  /** "Open for sale" — hidden from the storefront when false. */
  isActive: boolean;
  /** null = inventory not tracked (never sells out). */
  stock: number | null;
  /**
   * Sizes on sale, each with its own price. Empty = one size at `price`.
   * When set, `price`/`compareAtPrice` mirror the cheapest size ("from ₹X").
   */
  sizes: ProductSize[];
  /** Artwork width / height — turns "6 inch" into real dimensions. */
  aspectRatio: number | null;
  createdAt: string;
  updatedAt: string;
};

/** A sticker size: `inches` is the longest side. Prices in whole INR. */
export type ProductSize = {
  inches: number;
  price: number;
  compareAtPrice: number | null;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentProvider = "cashfree" | "simulator";

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
  /** Chosen size (longest side, inches); null for single-size products. */
  sizeInches: number | null;
  /** e.g. `6″ — 6 × 3.1 in`, frozen at order time for printing. */
  sizeLabel: string | null;
};

export type CustomerInfo = {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type Order = {
  id: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  pincode: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentProvider: PaymentProvider;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  paymentNote: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  /** The shopper account that placed it (null for demo-mode/legacy orders). */
  userId: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: OrderItem[];
};

export type ShipmentInfo = {
  courier: string;
  trackingNumber: string;
  trackingUrl: string | null;
};

export type ProductInput = {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  categoryId: string | null;
  imageUrl: string;
  tags: string[];
  featured: boolean;
  isNew: boolean;
  isActive: boolean;
  stock: number | null;
  sizes: ProductSize[];
  aspectRatio: number | null;
  thumbUrl?: string | null;
};

export type CategoryInput = {
  name: string;
  slug: string;
  sort: number;
};

export type NewOrderInput = {
  customer: CustomerInfo;
  items: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    imageUrl: string;
    sizeInches: number | null;
    sizeLabel: string | null;
  }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentProvider: PaymentProvider;
  userId: string | null;
};

export type AdminStats = {
  products: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  totalOrders: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  /** Sum of totals for orders that were successfully paid (paid/packed/shipped/delivered). */
  revenue: number;
  itemsSold: number;
};

export type ListProductsOpts = {
  activeOnly?: boolean;
  categorySlug?: string;
  q?: string;
};

import type { StoreSettings } from "./shipping";
import type { HomeRail } from "./home-rails";

export interface DataDriver {
  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  listProducts(opts?: ListProductsOpts): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getProductById(id: string): Promise<Product | null>;
  getProductsByIds(ids: string[]): Promise<Product[]>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  createOrder(input: NewOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(opts?: { status?: OrderStatus; limit?: number }): Promise<Order[]>;
  /** Idempotent: transitions pending/failed → paid and decrements tracked stock once. */
  markOrderPaid(
    id: string,
    info?: { paymentId?: string | null; note?: string | null }
  ): Promise<Order>;
  markOrderFailed(id: string, note?: string | null): Promise<Order>;
  /** Fulfillment transitions only: paid→packed→shipped→delivered. */
  /** Courier details are saved when marking an order shipped. */
  updateOrderStatus(
    id: string,
    status: "packed" | "shipped" | "delivered",
    shipment?: ShipmentInfo
  ): Promise<Order>;
  /** Allowed from pending/paid/packed; restocks items if payment had been captured. */
  cancelOrder(id: string): Promise<Order>;
  setCfOrderId(id: string, cfOrderId: string): Promise<void>;
  /** Records payment details without changing the status (e.g. paid after cancellation). */
  setPaymentNote(id: string, note: string, paymentId?: string | null): Promise<void>;
  /** A shopper's unpaid online-payment orders created since `sinceIso`, newest first. */
  listPendingOrdersForUser(userId: string, sinceIso: string): Promise<Order[]>;

  /** Minimum order + shipping zones (one row, edited in the admin). */
  getSettings(): Promise<StoreSettings>;
  updateSettings(settings: StoreSettings): Promise<StoreSettings>;
  /** Home page layout (DEFAULT_HOME_RAILS until edited). */
  getHomeRails(): Promise<HomeRail[]>;
  updateHomeRails(rails: HomeRail[]): Promise<HomeRail[]>;

  stats(): Promise<AdminStats>;
  /** Local demo driver only. */
  resetDemoData?(): Promise<void>;
}
