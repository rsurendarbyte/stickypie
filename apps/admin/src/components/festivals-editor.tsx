"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Eye, EyeOff, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  activeFestivals,
  FESTIVAL_DEFAULT_DAYS,
  festivalDate,
  festivalProducts,
  slugify,
  type Category,
  type Festival,
  type Product,
} from "@stickypie/shared";
import { CheckField, SelectField, TextAreaField, TextField } from "./field";
import { useToast } from "./toast";

/** "1 Nov 2026" from YYYY-MM-DD. */
function pretty(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** YYYY-MM-DD a number of days from another. */
function shift(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

export default function FestivalsEditor({
  initial,
  products,
  categories,
  shopUrl,
}: {
  initial: Festival[];
  products: Product[];
  categories: Category[];
  shopUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [festivals, setFestivals] = useState<Festival[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(festivals) !== saved;

  const onSale = useMemo(() => products.filter((p) => p.isActive), [products]);
  const liveNow = new Set(activeFestivals(festivals).map((f) => f.id));
  // soonest first, so the list reads like a calendar
  const order = [...festivals].sort((a, b) => festivalDate(a).localeCompare(festivalDate(b)));

  function update(id: string, patch: Partial<Festival>) {
    setFestivals((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function add() {
    const id = `festival-${Date.now().toString(36)}`;
    const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    setFestivals((list) => [
      ...list,
      {
        id,
        name: "",
        slug: "",
        date: today,
        yearly: true,
        daysBefore: FESTIVAL_DEFAULT_DAYS,
        daysAfter: FESTIVAL_DEFAULT_DAYS,
        tags: [],
        categoryId: null,
        title: "",
        description: "",
        intro: "",
        faq: [],
        visible: true,
      },
    ]);
    setOpen(id);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/festivals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(festivals),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setFestivals(data.festivals);
      setSaved(JSON.stringify(data.festivals));
      toast("Festivals saved — home page rows are live now");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-28">
      <ol className="space-y-3">
        {order.map((f) => {
          const date = festivalDate(f);
          const count = festivalProducts(f, onSale).length;
          const isOpen = open === f.id;
          return (
            <li
              key={f.id}
              className={`rounded-2xl border bg-ink2 transition-opacity ${
                f.visible ? "border-line" : "border-dashed border-line opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 p-4">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : f.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 text-fog transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                  <span className="truncate font-semibold">{f.name || "New festival"}</span>
                  <span className="shrink-0 text-xs text-fog">{pretty(date)}</span>
                </button>
                {liveNow.has(f.id) && (
                  <span className="rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-bold text-mint">
                    On the home page now
                  </span>
                )}
                <span className="text-xs text-fog">
                  {count} sticker{count === 1 ? "" : "s"}
                </span>
                <IconButton
                  label={f.visible ? "Hide festival" : "Show festival"}
                  onClick={() => update(f.id, { visible: !f.visible })}
                >
                  {f.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </IconButton>
                <IconButton
                  label="Delete festival"
                  danger
                  onClick={() => {
                    if (confirm(`Delete ${f.name || "this festival"}? Its page is removed at the next deploy.`))
                      setFestivals((list) => list.filter((x) => x.id !== f.id));
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-line/60 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Name"
                      value={f.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        // a new festival's page address follows its name until edited
                        const auto = !f.slug || f.slug === `${slugify(f.name)}-stickers`;
                        update(f.id, { name, ...(auto ? { slug: `${slugify(name)}-stickers` } : {}) });
                      }}
                      hint="Home row title and page heading"
                    />
                    <TextField
                      label="Page address"
                      value={f.slug}
                      onChange={(e) => update(f.id, { slug: slugify(e.target.value) })}
                      hint={`${shopUrl.replace(/^https?:\/\//, "")}/${f.slug || "…"}`}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_130px_130px]">
                    <TextField
                      label="Date"
                      type="date"
                      value={f.date}
                      onChange={(e) => e.target.value && update(f.id, { date: e.target.value })}
                      hint={`Home row: ${pretty(shift(date, -f.daysBefore))} – ${pretty(shift(date, f.daysAfter))}`}
                    />
                    <TextField
                      label="Days before"
                      type="number"
                      min={0}
                      max={60}
                      value={f.daysBefore}
                      onChange={(e) => update(f.id, { daysBefore: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                    />
                    <TextField
                      label="Days after"
                      type="number"
                      min={0}
                      max={60}
                      value={f.daysAfter}
                      onChange={(e) => update(f.id, { daysAfter: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                    />
                  </div>
                  <CheckField
                    label="Same date every year (turn off for Diwali, Holi … and change the date each year)"
                    checked={f.yearly}
                    onChange={(yearly) => update(f.id, { yearly })}
                  />

                  <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                    <TextField
                      label="Sticker tags"
                      value={f.tags.join(", ")}
                      onChange={(e) =>
                        update(f.id, {
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim().toLowerCase())
                            .filter((t, i, all) => t && all.indexOf(t) === i)
                            .slice(0, 30),
                        })
                      }
                      hint="Stickers with any of these tags show here (comma-separated)"
                    />
                    <SelectField
                      label="Or a category"
                      value={f.categoryId ?? ""}
                      onChange={(e) => update(f.id, { categoryId: e.target.value || null })}
                    >
                      <option value="">— none —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <p className="pt-2 text-[10.5px] font-semibold tracking-widest text-fog uppercase">
                    Its page — Google &amp; AI search
                  </p>
                  <TextField
                    label="Search title"
                    value={f.title}
                    maxLength={120}
                    onChange={(e) => update(f.id, { title: e.target.value })}
                    hint={`${f.title.length}/70 shown in Google · empty = "${f.name || "Name"} Stickers"`}
                  />
                  <TextAreaField
                    label="Search description"
                    rows={2}
                    maxLength={300}
                    value={f.description}
                    onChange={(e) => update(f.id, { description: e.target.value })}
                    hint={`${f.description.length}/148 fit in Google's snippet`}
                  />
                  <TextAreaField
                    label="Intro on the page"
                    rows={4}
                    maxLength={1200}
                    value={f.intro}
                    onChange={(e) => update(f.id, { intro: e.target.value })}
                    hint="What the day is, when it is, and what the stickers show"
                  />

                  <div className="space-y-2">
                    {f.faq.map((item, i) => (
                      <div key={i} className="rounded-xl border border-line/70 p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <TextField
                              label={`Question ${i + 1}`}
                              value={item.q}
                              maxLength={200}
                              onChange={(e) =>
                                update(f.id, { faq: f.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })
                              }
                            />
                            <TextAreaField
                              label="Answer"
                              rows={2}
                              maxLength={800}
                              value={item.a}
                              onChange={(e) =>
                                update(f.id, { faq: f.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })
                              }
                            />
                          </div>
                          <IconButton
                            label="Remove question"
                            danger
                            onClick={() => update(f.id, { faq: f.faq.filter((_, j) => j !== i) })}
                          >
                            <X className="size-4" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                    {f.faq.length < 12 && (
                      <button
                        type="button"
                        onClick={() => update(f.id, { faq: [...f.faq, { q: "", a: "" }] })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-snow"
                      >
                        <Plus className="size-3.5" /> Add a question
                      </button>
                    )}
                  </div>

                  {f.slug && saved.includes(`"${f.slug}"`) && (
                    <a
                      href={`${shopUrl}/${f.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      Open its page <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={add}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-fog transition-colors hover:border-brand/50 hover:text-snow"
      >
        <Plus className="size-3.5" /> Add a festival
      </button>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex w-full max-w-[1000px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="pie-gradient inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Save festivals
          </button>
          <span className="text-xs text-fog">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          {error && <span className="text-xs text-brand">{error}</span>}
          <a
            href={shopUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            View shop <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg text-fog transition-colors ${
        danger ? "hover:bg-brand/15 hover:text-brand" : "hover:bg-white/10 hover:text-snow"
      }`}
    >
      {children}
    </button>
  );
}
