"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, Download, Pencil, Search, Star, Trash2 } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, formatINR } from "@stickypie/shared";
import { imageDownloadHref, imageSrc } from "@/lib/img";
import { useToast } from "./toast";

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "pie-gradient" : "bg-panel"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function StockCell({ stock }: { stock: number | null }) {
  if (stock === null) return <span className="text-xs text-fog">not tracked</span>;
  if (stock === 0) {
    return (
      <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
        Out of stock
      </span>
    );
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
        {stock} left
      </span>
    );
  }
  return <span className="tabular-nums">{stock}</span>;
}

export default function ProductsTable({
  products: initial,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [products, setProducts] = useState(initial);
  const [query, setQuery] = useState("");
  // "" = all categories, "none" = products without a category.
  const [categoryFilter, setCategoryFilter] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const ids = (p.categoryIds ?? []).filter((id) => categoryName.has(id));
      if (ids.length === 0) counts.set("none", (counts.get("none") ?? 0) + 1);
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [products, categoryName]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const ids = (p.categoryIds ?? []).filter((id) => categoryName.has(id));
      if (categoryFilter === "none" ? ids.length > 0 : categoryFilter && !ids.includes(categoryFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [products, query, categoryFilter, categoryName]);

  async function patch(product: Product, changes: Partial<Product>, successMsg: string) {
    const before = products;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, ...changes } : p))
    );
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      setProducts(before);
      const data = await res.json().catch(() => ({}));
      toast(typeof data.error === "string" ? data.error : "Update failed", "error");
      return;
    }
    toast(successMsg);
    router.refresh();
  }

  async function remove(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(typeof data.error === "string" ? data.error : "Delete failed", "error");
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    toast(`Deleted "${product.name}"`);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fog" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="h-11 w-full rounded-full border border-line bg-ink2/70 pr-4 pl-10 text-sm outline-none transition-all placeholder:text-fog/50 hover:border-fog/40 focus:border-brand/70 focus:shadow-[0_0_0_3px_rgba(255,46,99,0.14)]"
          />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className={`h-11 cursor-pointer appearance-none rounded-full border bg-ink2/70 pr-10 pl-4 text-sm outline-none transition-all hover:border-fog/40 focus:border-brand/70 focus:shadow-[0_0_0_3px_rgba(255,46,99,0.14)] ${
              categoryFilter ? "border-brand/60 text-snow" : "border-line text-fog"
            }`}
          >
            <option value="">All categories ({products.length})</option>
            <optgroup label="──── By category ────">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({countByCategory.get(c.id) ?? 0})
                </option>
              ))}
            </optgroup>
            {countByCategory.has("none") && (
              <optgroup label="──── Other ────">
                <option value="none">No category ({countByCategory.get("none")})</option>
              </optgroup>
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-fog" />
        </div>
        {categoryFilter && (
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className="text-xs font-semibold text-fog transition-colors hover:text-brand"
          >
            Clear
          </button>
        )}
        <p className="ml-auto text-xs text-fog">
          {visible.length} of {products.length}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-ink2">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] tracking-wide text-fog uppercase">
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 text-center font-semibold">Featured</th>
              <th className="px-4 py-3 text-center font-semibold">New badge</th>
              <th className="px-4 py-3 font-semibold">Open for sale</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr
                key={product.id}
                className={`border-b border-line/50 transition-colors last:border-0 hover:bg-white/[0.03] ${
                  product.isActive ? "" : "opacity-55"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel p-1 ring-1 ring-line">
                      {product.imageUrl && (
                        <img
                          src={imageSrc(product.imageUrl)}
                          alt=""
                          className="sticker-cut-sm max-h-full max-w-full object-contain"
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[220px] truncate font-medium">{product.name}</p>
                      <p className="truncate text-xs text-fog">/{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-fog">
                  {(product.categoryIds ?? []).filter((id) => categoryName.has(id)).map((id) => categoryName.get(id)).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {(product.sizes?.length ?? 0) > 0 && (
                    <span className="mr-1.5 text-[11px] text-fog">
                      {product.sizes
                        .map((s) => s.inches)
                        .sort((a, b) => a - b)
                        .join("/")}
                      ″ · from
                    </span>
                  )}
                  <span className="font-semibold tabular-nums">{formatINR(product.price)}</span>
                  {product.compareAtPrice !== null && (
                    <span className="ml-1.5 text-xs text-fog line-through">
                      {formatINR(product.compareAtPrice)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StockCell stock={product.stock} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    aria-label={product.featured ? "Remove from featured" : "Mark as featured"}
                    onClick={() =>
                      patch(
                        product,
                        { featured: !product.featured },
                        product.featured ? "Removed from featured" : "Marked as featured"
                      )
                    }
                    className="text-fog transition-colors hover:text-gold"
                  >
                    <Star
                      className={`size-4.5 ${product.featured ? "fill-gold text-gold" : ""}`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    aria-pressed={product.isNew}
                    aria-label={product.isNew ? "Hide NEW badge" : "Show NEW badge"}
                    onClick={() =>
                      patch(
                        product,
                        { isNew: !product.isNew },
                        product.isNew ? "NEW badge hidden" : "NEW badge shown"
                      )
                    }
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                      product.isNew
                        ? "bg-mint text-ink"
                        : "border border-line text-fog/60 hover:border-mint/60 hover:text-mint"
                    }`}
                  >
                    New
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={product.isActive}
                    label={`Toggle ${product.name} availability`}
                    onChange={(next) =>
                      patch(
                        product,
                        { isActive: next },
                        next ? "Now open for sale" : "Hidden from the store"
                      )
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {product.imageUrl && (
                      <a
                        href={imageDownloadHref(product.imageUrl, product.name)}
                        download
                        aria-label={`Download ${product.name} image`}
                        title="Download image"
                        className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-white/10 hover:text-snow"
                      >
                        <Download className="size-4" />
                      </a>
                    )}
                    <Link
                      href={`/products/${product.id}/edit`}
                      aria-label={`Edit ${product.name}`}
                      className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-white/10 hover:text-snow"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${product.name}`}
                      onClick={() => remove(product)}
                      className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-brand/15 hover:text-brand"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-fog">
                  {categoryFilter && !query.trim() ? (
                    <>
                      No stickers in this category yet.{" "}
                      <Link href="/products/new" className="font-semibold text-brand hover:underline">
                        Add one →
                      </Link>
                    </>
                  ) : (
                    "No products match your search."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
