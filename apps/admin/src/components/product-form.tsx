"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Images, Loader2, Trash2, X } from "lucide-react";
import type { Category, Product } from "@stickypie/shared";
import {
  STICKER_SIZES,
  formatDimensions,
  formatINR,
  productInputSchema,
  slugify,
} from "@stickypie/shared";
import { imageDownloadHref, imageSrc } from "@/lib/img";
import { CheckField, SelectField, TextAreaField, TextField } from "./field";
import { useToast } from "./toast";

type LibraryImage = { name: string; url: string };
type SizeRow = { inches: number; on: boolean; price: string; compareAt: string };

export default function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: Product;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [compareAt, setCompareAt] = useState(
    product?.compareAtPrice ? String(product.compareAtPrice) : ""
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [tracked, setTracked] = useState(product ? product.stock !== null : true);
  const [stock, setStock] = useState(
    product && product.stock !== null ? String(product.stock) : "25"
  );
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [isNew, setIsNew] = useState(product?.isNew ?? true);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>(() =>
    STICKER_SIZES.map((inches) => {
      const existing = product?.sizes?.find((s) => s.inches === inches);
      return {
        inches,
        // New products start with every size on; existing ones keep what they sell.
        on: product ? Boolean(existing) : true,
        price: existing ? String(existing.price) : "",
        compareAt: existing?.compareAtPrice ? String(existing.compareAtPrice) : "",
      };
    })
  );
  const [aspectRatio, setAspectRatio] = useState<number | null>(product?.aspectRatio ?? null);
  const sizesOn = sizeRows.filter((row) => row.on);

  function updateSize(inches: number, patch: Partial<SizeRow>) {
    setSizeRows((rows) => rows.map((row) => (row.inches === inches ? { ...row, ...patch } : row)));
  }

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryImage[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Measure the artwork so sizes show real dimensions (longest side = size).
  useEffect(() => {
    const src = imageUrl.trim();
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
      setAspectRatio(Math.round((img.naturalWidth / img.naturalHeight) * 10000) / 10000);
    };
    img.src = imageSrc(src);
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  async function openLibrary() {
    setLibraryOpen(true);
    if (library) return;
    const res = await fetch("/api/library");
    const data = await res.json().catch(() => ({}));
    setLibrary(Array.isArray(data.images) ? data.images : []);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      setImageUrl(data.url as string);
      setLibrary(null); // refresh next time the library opens
      toast("Image uploaded");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const sizeErrors: Record<string, string> = {};
    for (const row of sizesOn) {
      const p = Number(row.price);
      if (!row.price || p < 1) sizeErrors[`size${row.inches}`] = "Enter a price";
      else if (row.compareAt && Number(row.compareAt) <= p)
        sizeErrors[`size${row.inches}`] = "Compare-at must be higher than the price";
    }
    if (Object.keys(sizeErrors).length > 0) {
      setErrors(sizeErrors);
      toast("Fix the size prices", "error");
      return;
    }
    const sizes = sizesOn.map((row) => ({
      inches: row.inches,
      price: Number(row.price),
      compareAtPrice: row.compareAt ? Number(row.compareAt) : null,
    }));
    const cheapest = [...sizes].sort((a, b) => a.price - b.price)[0];

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      price: cheapest ? cheapest.price : Number(price),
      compareAtPrice: cheapest
        ? cheapest.compareAtPrice
        : compareAt.trim() === ""
          ? null
          : Number(compareAt),
      sizes,
      aspectRatio,
      categoryId: categoryId || null,
      imageUrl: imageUrl.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
      featured,
      isNew,
      isActive,
      stock: tracked ? Number(stock) : null,
    };

    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast("Fix the highlighted fields", "error");
      return;
    }
    if (parsed.data.compareAtPrice !== null && parsed.data.compareAtPrice <= parsed.data.price) {
      setErrors({ compareAtPrice: "Compare-at price must be higher than the price" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/products/${product!.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      toast(editing ? "Product updated" : "Product created");
      router.push("/products");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
      setSaving(false);
    }
  }

  async function remove() {
    if (!product) return;
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(typeof data.error === "string" ? data.error : "Delete failed", "error");
      return;
    }
    toast("Product deleted");
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <TextField
            label="Slug (URL)"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            error={errors.slug}
          />
        </div>

        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          error={errors.description}
          hint="A punchy one-liner buyers read on the product page."
        />

        <div className="rounded-xl border border-line bg-ink2/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10.5px] font-semibold tracking-widest text-fog uppercase">
              Sizes &amp; prices
            </p>
            <p className="text-xs text-fog">
              Size = longest side. The lowest price shows first in the shop.
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {sizeRows.map((row) => (
              <div key={row.inches} className="grid items-start gap-3 sm:grid-cols-[150px_1fr_1fr]">
                <label className="flex cursor-pointer items-center gap-2.5 pt-3">
                  <input
                    type="checkbox"
                    checked={row.on}
                    onChange={(e) => updateSize(row.inches, { on: e.target.checked })}
                    className="size-4 accent-[#ff2e63]"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{row.inches} inch</span>
                    <span className="block text-[11px] text-fog">
                      {aspectRatio ? formatDimensions(row.inches, aspectRatio) : "size from image"}
                    </span>
                  </span>
                </label>
                {row.on ? (
                  <>
                    <TextField
                      label="Price (₹)"
                      value={row.price}
                      onChange={(e) =>
                        updateSize(row.inches, { price: e.target.value.replace(/\D/g, "") })
                      }
                      inputMode="numeric"
                      error={errors[`size${row.inches}`]}
                    />
                    <TextField
                      label="Compare-at (₹)"
                      value={row.compareAt}
                      onChange={(e) =>
                        updateSize(row.inches, { compareAt: e.target.value.replace(/\D/g, "") })
                      }
                      inputMode="numeric"
                      hint="Optional strike-through"
                    />
                  </>
                ) : (
                  <p className="pt-3 text-xs text-fog/70 sm:col-span-2">Not sold in this size</p>
                )}
              </div>
            ))}
          </div>
          {sizesOn.length === 0 && (
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <TextField
                label="Price (₹)"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                error={errors.price}
                hint="One size only — no size choice in the shop"
              />
              <TextField
                label="Compare-at (₹)"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                error={errors.compareAtPrice}
                hint="Optional strike-through price"
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="rounded-xl border border-line bg-ink2/60 p-4">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
            <CheckField label="Track inventory" checked={tracked} onChange={setTracked} />
            {tracked && (
              <TextField
                label="Stock"
                value={stock}
                onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                error={errors.stock}
                className="w-32"
              />
            )}
            <CheckField label="Open for sale" checked={isActive} onChange={setIsActive} />
            <CheckField
              label="Featured (hero & Top Picks)"
              checked={featured}
              onChange={setFeatured}
            />
            <CheckField label='Show "NEW" badge' checked={isNew} onChange={setIsNew} />
          </div>
        </div>

        <TextField
          label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          hint="e.g. jdm, racing, funny — used by search"
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="pie-gradient flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Create product"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-fog transition-colors hover:bg-white/5 hover:text-snow"
          >
            Cancel
          </button>
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Image + live preview */}
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[10.5px] font-semibold tracking-widest text-fog uppercase">
            Sticker image
          </span>
          <div
            className={`relative grid aspect-square place-items-center overflow-hidden rounded-2xl border bg-gradient-to-br from-[#1d1b33] to-[#2d2347] p-6 ${
              errors.imageUrl ? "border-brand/70" : "border-line"
            }`}
          >
            <div className="bg-dots absolute inset-0 opacity-40" />
            {imageUrl ? (
              <img
                src={imageSrc(imageUrl)}
                alt="Sticker preview"
                className="sticker-cut relative max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="relative px-6 text-center text-xs text-fog">
                Upload your sticker art (PNG with transparency looks best)
              </p>
            )}
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="size-7 animate-spin text-snow" />
              </div>
            )}
          </div>
          {errors.imageUrl && (
            <span className="mt-1.5 block text-xs text-brand">{errors.imageUrl}</span>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 text-xs font-semibold text-fog transition-colors hover:bg-white/5 hover:text-snow disabled:opacity-50"
            >
              <ImagePlus className="size-4" /> Upload file
            </button>
            <button
              type="button"
              onClick={openLibrary}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 text-xs font-semibold text-fog transition-colors hover:bg-white/5 hover:text-snow"
            >
              <Images className="size-4" /> Library
            </button>
            {imageUrl.trim() && (
              <a
                href={imageDownloadHref(imageUrl.trim(), name)}
                download
                title="Download image"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-3 text-xs font-semibold text-fog transition-colors hover:bg-white/5 hover:text-snow"
              >
                <Download className="size-4" /> Download
              </a>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
          <TextField
            label="…or paste an image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="mt-3"
          />
        </div>

        <div className="rounded-xl border border-line bg-ink2/60 p-4">
          <p className="text-[10.5px] font-semibold tracking-widest text-fog uppercase">
            Storefront preview
          </p>
          <div className="mx-auto mt-3 w-40">
            <div className="grid aspect-square place-items-center rounded-2xl bg-gradient-to-br from-[#122433] to-[#1b3a4b] p-4 ring-1 ring-white/5">
              {imageUrl && (
                <img
                  src={imageSrc(imageUrl)}
                  alt=""
                  className="max-h-full max-w-full sticker-cut-sm -rotate-3 object-contain"
                />
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium">{name || "Product name"}</p>
            {(() => {
              const lowest = sizesOn
                .filter((row) => Number(row.price) > 0)
                .sort((a, b) => Number(a.price) - Number(b.price))[0];
              const shownPrice = sizesOn.length > 0 ? lowest?.price : price;
              const shownCompare = sizesOn.length > 0 ? lowest?.compareAt : compareAt;
              return (
                <p className="font-display text-[15px] font-bold">
                  {shownPrice ? formatINR(Number(shownPrice)) : "₹—"}
                  {shownCompare && Number(shownCompare) > Number(shownPrice || 0) && (
                    <span className="ml-1.5 text-xs font-normal text-fog line-through">
                      {formatINR(Number(shownCompare))}
                    </span>
                  )}
                  {sizesOn.length > 1 && (
                    <span className="ml-1.5 text-xs font-normal text-fog">
                      · {sizesOn.length} sizes
                    </span>
                  )}
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Library modal */}
      {libraryOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-ink2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="font-display font-semibold">Image library</p>
              <button
                type="button"
                aria-label="Close library"
                onClick={() => setLibraryOpen(false)}
                className="grid size-8 place-items-center rounded-full text-fog hover:bg-white/10 hover:text-snow"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {library === null ? (
                <div className="grid place-items-center py-16">
                  <Loader2 className="size-6 animate-spin text-fog" />
                </div>
              ) : library.length === 0 ? (
                <p className="py-16 text-center text-sm text-fog">
                  No images yet — upload your first sticker file.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {library.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => {
                        setImageUrl(img.url);
                        setLibraryOpen(false);
                      }}
                      className={`group grid aspect-square place-items-center rounded-xl border bg-panel p-2 transition-all hover:border-brand/60 ${
                        imageUrl === img.url ? "border-brand" : "border-line"
                      }`}
                    >
                      <img
                        src={imageSrc(img.url)}
                        alt={img.name}
                        loading="lazy"
                        className="max-h-full sticker-cut-sm max-w-full object-contain transition-transform group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
