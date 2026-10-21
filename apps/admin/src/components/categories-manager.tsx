"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Category } from "@stickypie/shared";
import { slugify } from "@stickypie/shared";
import { TextField } from "./field";
import { useToast } from "./toast";

export default function CategoriesManager({
  categories: initial,
  productCounts,
}: {
  categories: Category[];
  productCounts: Record<string, number>;
}) {
  const [categories, setCategories] = useState(initial);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 2) return;
    setBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slugify(name), sort: categories.length + 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed");
      setCategories((prev) => [...prev, data.category as Category]);
      setNewName("");
      toast(`Category "${name}" created`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create category", "error");
    } finally {
      setBusy(false);
    }
  }

  async function rename(category: Category) {
    const name = editName.trim();
    if (name.length < 2) return;
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed");
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? (data.category as Category) : c))
      );
      setEditingId(null);
      toast("Category renamed");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not rename category", "error");
    }
  }

  async function remove(category: Category) {
    const count = productCounts[category.id] ?? 0;
    const warning =
      count > 0
        ? `Delete "${category.name}"? ${count} product${count === 1 ? "" : "s"} will become uncategorised (they stay on sale).`
        : `Delete "${category.name}"?`;
    if (!confirm(warning)) return;
    const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(typeof data.error === "string" ? data.error : "Delete failed", "error");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== category.id));
    toast(`Deleted "${category.name}"`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={create} className="flex items-start gap-2">
        <TextField
          label="New category name (e.g. Anime)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <button
          type="submit"
          disabled={busy || newName.trim().length < 2}
          className="pie-gradient flex h-14 items-center gap-1.5 rounded-xl px-6 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </button>
      </form>

      <ul className="mt-5 divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-ink2">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center gap-3 px-4 py-3">
            {editingId === category.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="h-9 flex-1 rounded-lg border border-line bg-ink px-3 text-sm outline-none focus:border-brand/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      rename(category);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={() => rename(category)}
                  className="grid size-8 place-items-center rounded-lg text-mint hover:bg-mint/10"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  onClick={() => setEditingId(null)}
                  className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/10"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-fog">/{category.slug}</p>
                </div>
                <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs text-fog tabular-nums">
                  {productCounts[category.id] ?? 0} products
                </span>
                <button
                  type="button"
                  aria-label={`Rename ${category.name}`}
                  onClick={() => {
                    setEditingId(category.id);
                    setEditName(category.name);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-white/10 hover:text-snow"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => remove(category)}
                  className="grid size-8 place-items-center rounded-lg text-fog transition-colors hover:bg-brand/15 hover:text-brand"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-fog">
            No categories yet — add your first one above.
          </li>
        )}
      </ul>
    </div>
  );
}
