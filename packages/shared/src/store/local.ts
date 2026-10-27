import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import seedData from "../seed-data.json";
import type {
  AdminStats,
  Category,
  CategoryInput,
  DataDriver,
  ListProductsOpts,
  NewOrderInput,
  Order,
  OrderStatus,
  Product,
  ProductInput,
} from "../types";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "../shipping";
import { rowToFeatures, type FeatureFlags } from "../features";
import { DEFAULT_HOME_RAILS, type HomeRail } from "../home-rails";
import { inCategory } from "../utils";
import type { ContactInput, ContactMessage, NewReviewInput, Review, ReviewStatus } from "../feedback";

type StoreShape = {
  categories: Category[];
  products: Product[];
  orders: Order[];
  settings?: StoreSettings;
  features?: FeatureFlags;
  homeRails?: HomeRail[];
  contactMessages?: ContactMessage[];
  reviews?: Review[];
};

const DAY_MS = 86_400_000;

function buildSeedStore(): StoreShape {
  const now = Date.now();
  const categories: Category[] = seedData.categories.map((c) => ({
    id: randomUUID(),
    name: c.name,
    slug: c.slug,
    sort: c.sort,
  }));
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const products: Product[] = seedData.products.map((p, i) => {
    // Stagger creation dates so "New Drops" ordering looks real.
    const created = new Date(now - i * 2 * DAY_MS).toISOString();
    return {
      id: randomUUID(),
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      categoryId: idBySlug.get(p.category) ?? null,
      categoryIds: idBySlug.has(p.category) ? [idBySlug.get(p.category)!] : [],
      imageUrl: p.image,
      tags: p.tags,
      featured: p.featured,
      isNew: false,
      isActive: p.isActive,
      stock: p.stock,
      sizes: [],
      aspectRatio: null,
      thumbUrl: null,
      displayUrl: null,
      createdAt: created,
      updatedAt: created,
    };
  });
  return { categories, products, orders: [] };
}

/**
 * File-backed demo driver used when Supabase env vars are not set.
 * Single-user/dev only: each mutation is a read-modify-write of one JSON file.
 */
export function createLocalDriver(filePath: string): DataDriver {
  const file = path.resolve(filePath);

  function persist(store: StoreShape): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  function load(): StoreShape {
    if (!fs.existsSync(file)) {
      const store = buildSeedStore();
      persist(store);
      return store;
    }
    return JSON.parse(fs.readFileSync(file, "utf8")) as StoreShape;
  }

  const now = () => new Date().toISOString();

  function assertSlugFree(store: StoreShape, slug: string, exceptId?: string) {
    if (store.products.some((p) => p.slug === slug && p.id !== exceptId)) {
      throw new Error(`A product with the slug "${slug}" already exists`);
    }
  }

  function getOrderOrThrow(store: StoreShape, id: string): Order {
    const order = store.orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    return order;
  }

  function restock(store: StoreShape, order: Order) {
    for (const item of order.items) {
      if (!item.productId) continue;
      const product = store.products.find((p) => p.id === item.productId);
      if (product && product.stock !== null) {
        product.stock += item.quantity;
        product.updatedAt = now();
      }
    }
  }

  return {
    async listCategories() {
      return [...load().categories].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    },

    async createCategory(input: CategoryInput) {
      const store = load();
      if (store.categories.some((c) => c.slug === input.slug)) {
        throw new Error(`A category with the slug "${input.slug}" already exists`);
      }
      const category: Category = { id: randomUUID(), ...input };
      store.categories.push(category);
      persist(store);
      return category;
    },

    async updateCategory(id, input) {
      const store = load();
      const category = store.categories.find((c) => c.id === id);
      if (!category) throw new Error("Category not found");
      if (input.slug && store.categories.some((c) => c.slug === input.slug && c.id !== id)) {
        throw new Error(`A category with the slug "${input.slug}" already exists`);
      }
      Object.assign(category, input);
      persist(store);
      return category;
    },

    async deleteCategory(id) {
      const store = load();
      store.categories = store.categories.filter((c) => c.id !== id);
      for (const p of store.products) {
        p.categoryIds = (p.categoryIds ?? []).filter((c) => c !== id);
        p.categoryId = p.categoryIds[0] ?? null;
      }
      persist(store);
    },

    async listProducts(opts: ListProductsOpts = {}) {
      const store = load();
      let products = [...store.products];
      if (opts.activeOnly) products = products.filter((p) => p.isActive);
      if (opts.categorySlug) {
        const cat = store.categories.find((c) => c.slug === opts.categorySlug);
        if (!cat) return [];
        products = products.filter((p) => inCategory(p, cat.id));
      }
      if (opts.q) {
        const q = opts.q.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getProductBySlug(slug) {
      return load().products.find((p) => p.slug === slug) ?? null;
    },

    async getProductById(id) {
      return load().products.find((p) => p.id === id) ?? null;
    },

    async getProductsByIds(ids) {
      const set = new Set(ids);
      return load().products.filter((p) => set.has(p.id));
    },

    async createProduct(input: ProductInput) {
      const store = load();
      assertSlugFree(store, input.slug);
      const ts = now();
      const product: Product = {
        id: randomUUID(),
        ...input,
        categoryId: input.categoryIds[0] ?? null,
        thumbUrl: input.thumbUrl ?? null,
        displayUrl: input.displayUrl ?? null,
        createdAt: ts,
        updatedAt: ts,
      };
      store.products.unshift(product);
      persist(store);
      return product;
    },

    async updateProduct(id, input) {
      const store = load();
      const product = store.products.find((p) => p.id === id);
      if (!product) throw new Error("Product not found");
      if (input.slug) assertSlugFree(store, input.slug, id);
      Object.assign(product, input, { updatedAt: now() });
      if (input.categoryIds) product.categoryId = input.categoryIds[0] ?? null;
      persist(store);
      return product;
    },

    async deleteProduct(id) {
      const store = load();
      store.products = store.products.filter((p) => p.id !== id);
      for (const order of store.orders) {
        for (const item of order.items) {
          if (item.productId === id) item.productId = null;
        }
      }
      persist(store);
    },

    async createOrder(input: NewOrderInput) {
      const store = load();
      const id = randomUUID();
      const ts = now();
      const order: Order = {
        id,
        status: "pending",
        customerName: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        address1: input.customer.address1,
        address2: input.customer.address2,
        city: input.customer.city,
        state: input.customer.state,
        pincode: input.customer.pincode,
        subtotal: input.subtotal,
        shippingFee: input.shippingFee,
        gstAmount: input.gstAmount,
        gstRate: input.gstRate,
        total: input.total,
        paymentProvider: input.paymentProvider,
        cfOrderId: null,
        cfPaymentId: null,
        paymentNote: null,
        createdAt: ts,
        updatedAt: ts,
        paidAt: null,
        userId: input.userId,
        packedAt: null,
        shippedAt: null,
        deliveredAt: null,
        courier: null,
        trackingNumber: null,
        trackingUrl: null,
        invoiceNumber: null,
        invoiceDate: null,
        shiprocketOrderId: null,
        shiprocketShipmentId: null,
        labelUrl: null,
        courierStatus: null,
        courierStatusAt: null,
        items: input.items.map((item) => ({
          id: randomUUID(),
          orderId: id,
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          sizeInches: item.sizeInches,
          sizeLabel: item.sizeLabel,
          isCustom: Boolean(item.isCustom),
          customFile: null,
          customRef: item.customRef ?? null,
          customSpec: item.customSpec ?? null,
          finishedFiles: [],
        })),
      };
      store.orders.unshift(order);
      persist(store);
      return order;
    },

    async getOrder(id) {
      return load().orders.find((o) => o.id === id) ?? null;
    },

    async listOrders(opts = {}) {
      let orders = [...load().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (opts.status) orders = orders.filter((o) => o.status === opts.status);
      if (opts.limit) orders = orders.slice(0, opts.limit);
      return orders;
    },

    async markOrderPaid(id, info = {}) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      if (order.status !== "pending" && order.status !== "failed") return order;
      order.status = "paid";
      order.paidAt = now();
      order.updatedAt = order.paidAt;
      if (info.paymentId) order.cfPaymentId = info.paymentId;
      if (info.note) order.paymentNote = info.note;
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = store.products.find((p) => p.id === item.productId);
        if (product && product.stock !== null) {
          product.stock = Math.max(0, product.stock - item.quantity);
          product.updatedAt = order.updatedAt;
        }
      }
      persist(store);
      return order;
    },

    async markOrderFailed(id, note) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      if (order.status !== "pending") return order;
      order.status = "failed";
      order.updatedAt = now();
      if (note) order.paymentNote = note;
      persist(store);
      return order;
    },

    async updateOrderStatus(id, status, shipment) {
      const allowedFrom: Record<string, OrderStatus> = {
        packed: "paid",
        shipped: "packed",
        delivered: "shipped",
      };
      const store = load();
      const order = getOrderOrThrow(store, id);
      if (order.status !== allowedFrom[status]) {
        throw new Error(`Cannot mark a "${order.status}" order as "${status}"`);
      }
      const ts = now();
      order.status = status;
      order.updatedAt = ts;
      if (status === "packed") order.packedAt = ts;
      if (status === "delivered") order.deliveredAt = ts;
      if (status === "shipped") {
        order.shippedAt = ts;
        if (shipment) {
          order.courier = shipment.courier;
          order.trackingNumber = shipment.trackingNumber;
          order.trackingUrl = shipment.trackingUrl;
        }
      }
      persist(store);
      return order;
    },

    async cancelOrder(id) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      if (!["pending", "paid", "packed"].includes(order.status)) {
        throw new Error(`Cannot cancel a "${order.status}" order`);
      }
      if (order.status === "paid" || order.status === "packed") {
        restock(store, order);
      }
      order.status = "cancelled";
      order.updatedAt = now();
      persist(store);
      return order;
    },

    async setCfOrderId(id, cfOrderId) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      order.cfOrderId = cfOrderId;
      order.updatedAt = now();
      persist(store);
    },

    async setPaymentNote(id, note, paymentId) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      order.paymentNote = note;
      if (paymentId) order.cfPaymentId = paymentId;
      order.updatedAt = now();
      persist(store);
    },

    async listPendingOrdersForUser(userId, sinceIso) {
      return load()
        .orders.filter(
          (o) =>
            o.userId === userId &&
            o.status === "pending" &&
            o.paymentProvider !== "simulator" &&
            o.createdAt >= sinceIso
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
    },

    async setShipmentRefs(id, refs) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      if (refs.shiprocketOrderId !== undefined) order.shiprocketOrderId = refs.shiprocketOrderId;
      if (refs.shiprocketShipmentId !== undefined) order.shiprocketShipmentId = refs.shiprocketShipmentId;
      if (refs.labelUrl !== undefined) order.labelUrl = refs.labelUrl;
      if (refs.courier !== undefined) order.courier = refs.courier;
      if (refs.trackingNumber !== undefined) order.trackingNumber = refs.trackingNumber;
      if (refs.trackingUrl !== undefined) order.trackingUrl = refs.trackingUrl;
      persist(store);
    },

    async setCourierStatus(id, status) {
      const store = load();
      const order = getOrderOrThrow(store, id);
      order.courierStatus = status;
      order.courierStatusAt = now();
      persist(store);
    },

    async findOrderForShipment(ref) {
      const orders = load().orders;
      return (
        (ref.orderId && orders.find((o) => o.id === ref.orderId)) ||
        (ref.shiprocketOrderId && orders.find((o) => o.shiprocketOrderId === ref.shiprocketOrderId)) ||
        (ref.awb && orders.find((o) => o.trackingNumber === ref.awb)) ||
        null
      );
    },

    async getSettings() {
      return load().settings ?? DEFAULT_STORE_SETTINGS;
    },

    async updateSettings(settings: StoreSettings) {
      const store = load();
      store.settings = settings;
      persist(store);
      return settings;
    },

    async getHomeRails() {
      return load().homeRails ?? DEFAULT_HOME_RAILS;
    },

    async updateHomeRails(rails: HomeRail[]) {
      const store = load();
      store.homeRails = rails;
      persist(store);
      return rails;
    },

    async replaceCustomFile(orderId: string, itemId: string, path: string, url: string) {
      const store = load();
      const item = store.orders.find((o) => o.id === orderId)?.items.find((i) => i.id === itemId);
      if (!item?.isCustom) throw new Error("Not a custom sticker");
      item.customFile = path;
      item.imageUrl = url;
      persist(store);
    },

    async setFinishedFiles(orderId: string, itemId: string, urls: string[]) {
      const store = load();
      const item = store.orders.find((o) => o.id === orderId)?.items.find((i) => i.id === itemId);
      if (!item?.isCustom) throw new Error("Not a custom sticker");
      item.finishedFiles = urls;
      persist(store);
    },

    async getFeatures() {
      return rowToFeatures(load().features);
    },

    async updateFeatures(flags: FeatureFlags) {
      const store = load();
      store.features = flags;
      persist(store);
      return flags;
    },

    async createContactMessage(input: ContactInput) {
      const store = load();
      store.contactMessages = [
        { ...input, id: randomUUID(), status: "new", createdAt: now() },
        ...(store.contactMessages ?? []),
      ];
      persist(store);
    },

    async listContactMessages() {
      return load().contactMessages ?? [];
    },

    async setContactStatus(id, status) {
      const store = load();
      const m = store.contactMessages?.find((x) => x.id === id);
      if (m) m.status = status;
      persist(store);
    },

    async deleteContactMessage(id) {
      const store = load();
      store.contactMessages = (store.contactMessages ?? []).filter((x) => x.id !== id);
      persist(store);
    },

    async createReview(input: NewReviewInput) {
      const store = load();
      if ((store.reviews ?? []).some((r) => r.orderItemId === input.orderItemId)) {
        throw new Error("You've already reviewed this sticker.");
      }
      const review: Review = { ...input, id: randomUUID(), status: "pending", createdAt: now(), reviewedAt: null };
      store.reviews = [review, ...(store.reviews ?? [])];
      persist(store);
      return review;
    },

    async listReviews(status?: ReviewStatus) {
      const all = load().reviews ?? [];
      return status ? all.filter((r) => r.status === status) : all;
    },

    async listOrderReviews(orderId) {
      return (load().reviews ?? []).filter((r) => r.orderId === orderId);
    },

    async setReviewStatus(id, status) {
      const store = load();
      const r = store.reviews?.find((x) => x.id === id);
      if (r) Object.assign(r, { status, reviewedAt: now() });
      persist(store);
    },

    async deleteReview(id) {
      const store = load();
      store.reviews = (store.reviews ?? []).filter((x) => x.id !== id);
      persist(store);
    },

    async stats() {
      const store = load();
      const ordersByStatus: Partial<Record<OrderStatus, number>> = {};
      let revenue = 0;
      let itemsSold = 0;
      const paidLike: OrderStatus[] = ["paid", "packed", "shipped", "delivered"];
      for (const order of store.orders) {
        ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
        if (paidLike.includes(order.status)) {
          revenue += order.total;
          itemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
        }
      }
      const stats: AdminStats = {
        products: store.products.length,
        activeProducts: store.products.filter((p) => p.isActive).length,
        outOfStock: store.products.filter((p) => p.stock === 0).length,
        lowStock: store.products.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= 3)
          .length,
        totalOrders: store.orders.length,
        ordersByStatus,
        revenue,
        itemsSold,
      };
      return stats;
    },

    async resetDemoData() {
      persist(buildSeedStore());
    },
  };
}
