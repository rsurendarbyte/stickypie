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
import { rowToSettings, settingsToRow, type StoreSettings } from "../shipping";
import { rowToFeatures, type FeatureFlags } from "../features";
import { rowToHomeRails, type HomeRail } from "../home-rails";
import {
  REVIEW_PHOTO_BUCKET,
  rowToContact,
  rowToReview,
  type ContactInput,
  type NewReviewInput,
  type ReviewStatus,
} from "../feedback";

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
  /**
   * Deletes a review's photo from storage (no-op without one). A whole-order
   * review shares one photo across several reviews — the file is only removed
   * once no other review still uses it.
   */
  async function removeReviewPhoto(reviewId: string) {
    const { data } = await client.from("product_reviews").select("photo_path").eq("id", reviewId).maybeSingle();
    const path = data?.photo_path as string | null | undefined;
    if (!path) return;
    const { count } = await client
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("photo_path", path)
      .neq("id", reviewId);
    if ((count ?? 0) > 0) return;
    const { error } = await client.storage.from(REVIEW_PHOTO_BUCKET).remove([path]);
    if (error) throw new Error(`Couldn't remove the review photo: ${error.message}`);
  }

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
      if (categoryId) query = query.contains("category_ids", [categoryId]);
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
          gst_amount: input.gstAmount,
          gst_rate: input.gstRate,
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
        // Every row carries every column: a bulk insert fills a column some
        // rows leave out with null (not its default), which breaks mixed
        // custom + regular orders on the not-null is_custom.
        size_inches: item.sizeInches ?? null,
        size_label: item.sizeInches != null ? item.sizeLabel : null,
        is_custom: Boolean(item.isCustom),
        custom_ref: item.isCustom ? (item.customRef ?? null) : null,
        custom_spec: item.isCustom ? (item.customSpec ?? null) : null,
      }));
      const { error: itemsError } = await client.from("order_items").insert(items);
      if (itemsError) {
        // Don't leave an empty pending order behind.
        await client.from("orders").delete().eq("id", orderRow.id);
        throw friendly(itemsError);
      }
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

    async setPaymentNote(id, note, paymentId) {
      const changes: Record<string, unknown> = { payment_note: note };
      if (paymentId) changes.cf_payment_id = paymentId;
      const { error } = await client.from("orders").update(changes).eq("id", id);
      if (error) throw friendly(error);
    },

    async setShipmentRefs(id, refs) {
      const changes: Record<string, unknown> = {};
      if (refs.shiprocketOrderId !== undefined) changes.shiprocket_order_id = refs.shiprocketOrderId;
      if (refs.shiprocketShipmentId !== undefined) changes.shiprocket_shipment_id = refs.shiprocketShipmentId;
      if (refs.labelUrl !== undefined) changes.shipping_label_url = refs.labelUrl;
      if (refs.courier !== undefined) changes.courier = refs.courier;
      if (refs.trackingNumber !== undefined) changes.tracking_number = refs.trackingNumber;
      if (refs.trackingUrl !== undefined) changes.tracking_url = refs.trackingUrl;
      const { error } = await client.from("orders").update(changes).eq("id", id);
      if (error) throw friendly(error);
    },

    async setCourierStatus(id, status) {
      const { error } = await client
        .from("orders")
        .update({ courier_status: status, courier_status_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw friendly(error);
    },

    async findOrderForShipment(ref) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (ref.orderId && uuid.test(ref.orderId)) {
        const order = await getOrder(ref.orderId);
        if (order) return order;
      }
      for (const [column, value] of [
        ["shiprocket_order_id", ref.shiprocketOrderId],
        ["tracking_number", ref.awb],
      ] as const) {
        if (!value) continue;
        const { data } = await client.from("orders").select("id").eq(column, value).limit(1);
        if (data?.[0]) return getOrder(data[0].id);
      }
      return null;
    },

    async listPendingOrdersForUser(userId, sinceIso) {
      const { data, error } = await client
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .neq("payment_provider", "simulator")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw friendly(error);
      return (data ?? []).map(rowToOrder);
    },

    async getSettings() {
      const { data, error } = await client.from("store_settings").select("*").eq("id", 1).maybeSingle();
      // Table missing (migration not applied yet) → built-in defaults.
      if (error) return rowToSettings(null);
      return rowToSettings(data);
    },

    async updateSettings(settings: StoreSettings) {
      const { data, error } = await client
        .from("store_settings")
        .update(settingsToRow(settings))
        .eq("id", 1)
        .select()
        .single();
      if (error) throw friendly(error);
      return rowToSettings(data);
    },

    async getHomeRails() {
      const { data, error } = await client.from("store_settings").select("home_rails").eq("id", 1).maybeSingle();
      if (error) return rowToHomeRails(null);
      return rowToHomeRails(data?.home_rails);
    },

    async updateHomeRails(rails: HomeRail[]) {
      const { data, error } = await client
        .from("store_settings")
        .update({ home_rails: rails })
        .eq("id", 1)
        .select("home_rails")
        .single();
      if (error) throw friendly(error);
      return rowToHomeRails(data.home_rails);
    },

    async replaceCustomFile(orderId: string, itemId: string, path: string, url: string) {
      const { error } = await client
        .from("order_items")
        .update({ custom_file: path, image_url: url })
        .eq("id", itemId)
        .eq("order_id", orderId)
        .eq("is_custom", true);
      if (error) throw friendly(error);
    },

    async setFinishedFiles(orderId: string, itemId: string, urls: string[]) {
      // Admins can't update order lines directly (RLS); this RPC checks is_admin().
      const { error } = await client.rpc("admin_set_finished_files", {
        p_order_id: orderId,
        p_item_id: itemId,
        p_files: urls,
      });
      if (error) throw friendly(error);
    },

    async getFeatures() {
      const { data, error } = await client.from("store_settings").select("features").eq("id", 1).maybeSingle();
      if (error) return rowToFeatures(null);
      return rowToFeatures(data?.features);
    },

    async updateFeatures(flags: FeatureFlags) {
      const { data, error } = await client
        .from("store_settings")
        .update({ features: flags })
        .eq("id", 1)
        .select("features")
        .single();
      if (error) throw friendly(error);
      return rowToFeatures(data.features);
    },

    async createContactMessage(input: ContactInput) {
      const { error } = await client.from("contact_messages").insert({
        name: input.name,
        email: input.email,
        phone: input.phone,
        order_code: input.orderCode,
        topic: input.topic,
        message: input.message,
      });
      if (error) throw friendly(error);
    },

    async listContactMessages() {
      const { data, error } = await client
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw friendly(error);
      return (data ?? []).map(rowToContact);
    },

    async setContactStatus(id: string, status: "new" | "resolved") {
      const { error } = await client.from("contact_messages").update({ status }).eq("id", id);
      if (error) throw friendly(error);
    },

    async deleteContactMessage(id: string) {
      const { error } = await client.from("contact_messages").delete().eq("id", id);
      if (error) throw friendly(error);
    },

    async createReview(input: NewReviewInput) {
      const { data, error } = await client
        .from("product_reviews")
        .insert({
          product_id: input.productId,
          order_id: input.orderId,
          order_item_id: input.orderItemId,
          user_id: input.userId,
          author_name: input.authorName,
          rating: input.rating,
          body: input.body,
          photo_path: input.photoPath,
          photo_url: input.photoUrl,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("You've already reviewed this sticker.");
        throw friendly(error);
      }
      return rowToReview(data);
    },

    async listReviews(status?: ReviewStatus) {
      let query = client.from("product_reviews").select("*").order("created_at", { ascending: false }).limit(500);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw friendly(error);
      return (data ?? []).map(rowToReview);
    },

    async listOrderReviews(orderId: string) {
      const { data, error } = await client.from("product_reviews").select("*").eq("order_id", orderId);
      if (error) throw friendly(error);
      return (data ?? []).map(rowToReview);
    },

    async setReviewStatus(id: string, status: ReviewStatus) {
      const patch: Record<string, unknown> = { status, reviewed_at: new Date().toISOString() };
      if (status === "rejected") {
        // A rejected review's photo is removed for good.
        await removeReviewPhoto(id);
        patch.photo_path = null;
        patch.photo_url = null;
      }
      const { error } = await client.from("product_reviews").update(patch).eq("id", id);
      if (error) throw friendly(error);
    },

    async deleteReview(id: string) {
      await removeReviewPhoto(id);
      const { error } = await client.from("product_reviews").delete().eq("id", id);
      if (error) throw friendly(error);
    },

    async stats() {
      const { data, error } = await client.rpc("admin_stats");
      if (error) throw friendly(error);
      return data as AdminStats;
    },
  };
}
