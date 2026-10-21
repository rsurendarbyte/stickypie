import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminStats,
  CategoryInput,
  DataDriver,
  ListProductsOpts,
  NewOrderInput,
  Order,
  ProductInput,
} from "../types";
import {
  productToRow,
  rowToCategory,
  rowToOrder,
  rowToProduct,
} from "./mappers";

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    return new Error("That slug is already in use — pick another one");
  }
  return new Error(error.message);
}

/**
 * Supabase-backed driver. Pass a server-side client:
 *  - storefront: a service-role client (order writes bypass RLS),
 *  - admin app: the signed-in admin's client (RLS enforces admin-only writes).
 */
export function createSupabaseDriver(client: SupabaseClient): DataDriver {
  async function getOrder(id: string): Promise<Order | null> {
    const { data, error } = await client
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw friendly(error);
    return data ? rowToOrder(data) : null;
  }

  async function getOrderOrThrow(id: string): Promise<Order> {
    const order = await getOrder(id);
    if (!order) throw new Error("Order not found");
    return order;
  }

  return {
    async listCategories() {
      const { data, error } = await client
        .from("categories")
        .select("*")
        .order("sort", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw friendly(error);
      return (data ?? []).map(rowToCategory);
    },

    async createCategory(input: CategoryInput) {
      const { data, error } = await client
        .from("categories")
        .insert({ name: input.name, slug: input.slug, sort: input.sort })
        .select()
        .single();
      if (error) throw friendly(error);
      return rowToCategory(data);
    },

    async updateCategory(id, input) {
      const { data, error } = await client
        .from("categories")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw friendly(error);
      return rowToCategory(data);
    },

    async deleteCategory(id) {
      const { error } = await client.from("categories").delete().eq("id", id);
      if (error) throw friendly(error);
    },

    async listProducts(opts: ListProductsOpts = {}) {
      let categoryId: string | null = null;
      if (opts.categorySlug) {
        const { data: cat, error } = await client
          .from("categories")
          .select("id")
          .eq("slug", opts.categorySlug)
          .maybeSingle();
        if (error) throw friendly(error);
        if (!cat) return [];
        categoryId = cat.id;
      }
      let query = client.from("products").select("*").order("created_at", { ascending: false });
      if (opts.activeOnly) query = query.eq("is_active", true);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (opts.q) query = query.ilike("name", `%${opts.q}%`);
      const { data, error } = await query;
      if (error) throw friendly(error);
      return (data ?? []).map(rowToProduct);
    },

    async getProductBySlug(slug) {
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw friendly(error);
      return data ? rowToProduct(data) : null;
    },

    async getProductById(id) {
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw friendly(error);
      return data ? rowToProduct(data) : null;
    },

    async getProductsByIds(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await client.from("products").select("*").in("id", ids);
      if (error) throw friendly(error);
      return (data ?? []).map(rowToProduct);
    },

    async createProduct(input: ProductInput) {
      const { data, error } = await client
        .from("products")
        .insert(productToRow(input))
        .select()
        .single();
      if (error) throw friendly(error);
      return rowToProduct(data);
    },

    async updateProduct(id, input) {
      const { data, error } = await client
        .from("products")
        .update(productToRow(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw friendly(error);
      return rowToProduct(data);
    },

    async deleteProduct(id) {
      const { error } = await client.from("products").delete().eq("id", id);
      if (error) throw friendly(error);
    },

    async createOrder(input: NewOrderInput) {
      const { data: orderRow, error } = await client
        .from("orders")
        .insert({
          status: "pending",
          customer_name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone,
          address1: input.customer.address1,
          address2: input.customer.address2,
          city: input.customer.city,
          state: input.customer.state,
          pincode: input.customer.pincode,
          subtotal: input.subtotal,
          shipping_fee: input.shippingFee,
          total: input.total,
          payment_provider: input.paymentProvider,
          ...(input.userId ? { user_id: input.userId } : {}),
        })
        .select()
        .single();
      if (error) throw friendly(error);
      const items = input.items.map((item) => ({
        order_id: orderRow.id,
        product_id: item.productId,
        name: item.name,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        image_url: item.imageUrl,
      }));
      const { error: itemsError } = await client.from("order_items").insert(items);
      if (itemsError) throw friendly(itemsError);
      return getOrderOrThrow(orderRow.id);
    },

    getOrder,

    async listOrders(opts = {}) {
      let query = client
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (opts.status) query = query.eq("status", opts.status);
      if (opts.limit) query = query.limit(opts.limit);
      const { data, error } = await query;
      if (error) throw friendly(error);
      return (data ?? []).map(rowToOrder);
    },

    async markOrderPaid(id, info = {}) {
      const { error } = await client.rpc("confirm_order_paid", {
        p_order_id: id,
        p_payment_id: info.paymentId ?? null,
        p_note: info.note ?? null,
      });
      if (error) throw friendly(error);
      return getOrderOrThrow(id);
    },

    async markOrderFailed(id, note) {
      const { error } = await client
        .from("orders")
        .update({ status: "failed", payment_note: note ?? null })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw friendly(error);
      return getOrderOrThrow(id);
    },

    async updateOrderStatus(id, status, shipment) {
      const allowedFrom: Record<string, string> = {
        packed: "paid",
        shipped: "packed",
        delivered: "shipped",
      };
      const current = await getOrderOrThrow(id);
      if (current.status !== allowedFrom[status]) {
        throw new Error(`Cannot mark a "${current.status}" order as "${status}"`);
      }
      // packed_at / shipped_at / delivered_at are stamped by a database trigger.
      const changes: Record<string, unknown> = { status };
      if (status === "shipped" && shipment) {
        changes.courier = shipment.courier;
        changes.tracking_number = shipment.trackingNumber;
        changes.tracking_url = shipment.trackingUrl;
      }
      const { error } = await client.from("orders").update(changes).eq("id", id);
      if (error) throw friendly(error);
      return getOrderOrThrow(id);
    },

    async cancelOrder(id) {
      const { error } = await client.rpc("cancel_order", { p_order_id: id });
      if (error) throw friendly(error);
      return getOrderOrThrow(id);
    },

    async setCfOrderId(id, cfOrderId) {
      const { error } = await client.from("orders").update({ cf_order_id: cfOrderId }).eq("id", id);
      if (error) throw friendly(error);
    },

    async stats() {
      const { data, error } = await client.rpc("admin_stats");
      if (error) throw friendly(error);
      return data as AdminStats;
    },
  };
}
