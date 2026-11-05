"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Frame, Image, LayoutList, Loader2, Minus, Pin, Plus, RotateCcw, Rows3, Search, X } from "lucide-react";
import {
  DEFAULT_HOME_PAGE,
  HOME_SECTIONS,
  HOME_SLIDES,
  WALL_MIX_ROW,
  arrangeWallRow,
  type HomeHeroCopy,
  type HomePage,
  type HomeSlideId,
  type WallRowCards,
} from "@stickypie/shared";
import { imageSrc } from "@/lib/img";
import { TextField } from "./field";
import { useToast } from "./toast";

export type WallOption = { slug: string; name: string; image: string; theme: string | null; paint: string | null; posters: number };

const TABS = [
  { id: "hero", label: "Hero banner", icon: Image },
  { id: "order", label: "Page order", icon: LayoutList },
  { id: "walls", label: "Wall cards", icon: Frame },
  { id: "rails", label: "Product rails", icon: Rows3 },
] as const;
type Tab = (typeof TABS)[number]["id"];

const shortName = (name: string) => name.replace(/\s*—\s*\d+\s+Mini Poster Pack\s*$/i, "").replace(/\s+Wall Setup$/i, "");

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Panel({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-ink2 p-4 sm:p-5">
      {title && <h2 className="font-semibold">{title}</h2>}
      {hint && <p className="mt-0.5 text-xs text-fog">{hint}</p>}
      <div className={title || hint ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "pie-gradient" : "bg-panel"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function SwitchRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-fog">{hint}</p>}
      </div>
      <Switch on={on} label={label} onChange={onChange} />
    </div>
  );
}

function Arrows({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  const icon = "grid size-7 place-items-center rounded-md text-fog hover:bg-white/5 hover:text-snow";
  return (
    <span className="flex shrink-0">
      <button
        type="button"
        aria-label="Move up"
        className={icon}
        onClick={(e) => {
          e.stopPropagation();
          onUp();
        }}
      >
        <ArrowUp className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        className={icon}
        onClick={(e) => {
          e.stopPropagation();
          onDown();
        }}
      >
        <ArrowDown className="size-4" />
      </button>
    </span>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      <span className="flex justify-between">
        {label}
        <span className="text-brand">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[#ff2e63]" />
    </label>
  );
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  const icon = "grid size-9 place-items-center text-fog hover:text-snow disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <p className="text-sm font-medium">{label}</p>
      <span className="flex items-center rounded-lg border border-line">
        <button type="button" aria-label="Less" disabled={value <= 0} onClick={() => onChange(value - 1)} className={icon}>
          <Minus className="size-4" />
        </button>
        <span className="w-7 text-center text-sm font-bold">{value}</span>
        <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)} className={icon}>
          <Plus className="size-4" />
        </button>
      </span>
    </div>
  );
}

function Chips({ chips, onChange }: { chips: string[]; onChange: (chips: string[]) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-fog">Small labels (leave one empty to hide it)</p>
      <div className="grid grid-cols-2 gap-2">
        {chips.map((chip, i) => (
          <TextField
            key={i}
            label={`Label ${i + 1}`}
            value={chip}
            maxLength={30}
            onChange={(e) => onChange(chips.map((c, n) => (n === i ? e.target.value : c)))}
          />
        ))}
      </div>
    </div>
  );
}

/** The slide's words as shoppers read them, updating while you type. */
function SlidePreview({ badge, title, title2, text, cards, button, chips }: {
  badge: string;
  title: string;
  title2?: string;
  text?: string;
  cards?: { title: string; text: string; button: string }[];
  button?: string;
  chips: string[];
}) {
  return (
    <div className="rounded-xl bg-[#fafaf8] p-4 text-[#15161e]">
      <p className="text-[10px] font-semibold tracking-wide text-fog uppercase">Preview</p>
      <span className="mt-2 inline-block rounded-full bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-orange-600 uppercase">{badge}</span>
      <p className="mt-2 font-display text-2xl leading-tight font-bold">
        {title}
        {title2 && (
          <>
            <br />
            {title2}
          </>
        )}
      </p>
      {text && <p className="mt-1.5 text-sm text-neutral-500">{text}</p>}
      {cards && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {cards.map((card, i) => (
            <div key={i} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-2.5">
              <p className="text-sm font-bold">{card.title}</p>
              <p className="flex-1 text-xs leading-snug text-neutral-500">{card.text}</p>
              <span className="mt-2 rounded-lg bg-amber-300 py-1.5 text-center text-xs font-bold">{card.button}</span>
            </div>
          ))}
        </div>
      )}
      {button && <span className="mt-2.5 inline-block rounded-lg bg-amber-300 px-4 py-2 text-xs font-bold">{button}</span>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {chips.filter(Boolean).map((chip, i) => (
          <span key={i} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function CopyFields({ copy, onChange }: { copy: HomeHeroCopy; onChange: (copy: HomeHeroCopy) => void }) {
  const set = (field: keyof Omit<HomeHeroCopy, "chips">) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...copy, [field]: e.target.value });
  return (
    <div className="space-y-2">
      <TextField label="Heading" value={copy.title} onChange={set("title")} />
      <TextField label="Description" value={copy.text} onChange={set("text")} />
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Badge" value={copy.badge} onChange={set("badge")} />
        <TextField label="Button" value={copy.button} onChange={set("button")} />
      </div>
      <Chips chips={copy.chips} onChange={(chips) => onChange({ ...copy, chips })} />
    </div>
  );
}

function HeroTab({ page, patch }: { page: HomePage; patch: (change: Partial<HomePage>) => void }) {
  const [open, setOpen] = useState<HomeSlideId>(page.slides.find((s) => s.visible)?.id ?? "avatar");
  const a = page.avatar;
  const avatar = (change: Partial<HomePage["avatar"]>) => patch({ avatar: { ...a, ...change } });
  const lastOn = page.slides.filter((s) => s.visible).length === 1;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-4">
        <Panel title="Slides" hint="Click a slide to edit it.">
          <ul className="space-y-1">
            {page.slides.map((slide, i) => (
              <li
                key={slide.id}
                onClick={() => setOpen(slide.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${open === slide.id ? "border-brand/60 bg-brand/5" : "border-transparent hover:bg-white/5"}`}
              >
                <span className="w-4 text-xs font-bold text-fog">{i + 1}</span>
                <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${slide.visible ? "" : "text-fog"}`}>{HOME_SLIDES[slide.id].label}</p>
                <Arrows onUp={() => patch({ slides: move(page.slides, i, i - 1) })} onDown={() => patch({ slides: move(page.slides, i, i + 1) })} />
                <Switch
                  on={slide.visible}
                  label={`Show ${HOME_SLIDES[slide.id].label}`}
                  onChange={(on) => {
                    if (on || !lastOn) patch({ slides: page.slides.map((s) => (s.id === slide.id ? { ...s, visible: on } : s)) });
                  }}
                />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="How it behaves">
          <Slider label="Time on each slide" value={page.seconds} min={2} max={15} step={0.5} unit=" sec" onChange={(seconds) => patch({ seconds })} />
          <div className="mt-2 divide-y divide-line">
            <SwitchRow label="Festival stickers first" hint="Around each festival's date" on={page.festivals} onChange={(festivals) => patch({ festivals })} />
            <SwitchRow label="Hide state and city items" hint="Keeps the banner for all of India" on={page.hideRegional} onChange={(hideRegional) => patch({ hideRegional })} />
          </div>
        </Panel>
      </div>

      <Panel title={HOME_SLIDES[open].label}>
        {open === "avatar" && (
          <div className="space-y-3">
            <SlidePreview
              badge={a.badge}
              title={a.titleTop}
              title2={a.titleBottom}
              cards={[
                { title: a.stickerTitle, text: a.stickerText.replace("{styles}", "4"), button: a.stickerButton },
                { title: a.wallTitle, text: a.wallText, button: a.wallButton },
              ]}
              chips={a.chips}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Heading line 1" value={a.titleTop} onChange={(e) => avatar({ titleTop: e.target.value })} />
              <TextField label="Heading line 2" value={a.titleBottom} onChange={(e) => avatar({ titleBottom: e.target.value })} />
            </div>
            <TextField label="Badge" value={a.badge} onChange={(e) => avatar({ badge: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-fog">Stickers card</p>
                <TextField label="Title" value={a.stickerTitle} onChange={(e) => avatar({ stickerTitle: e.target.value })} />
                <TextField label="Text" hint="{styles} shows the number of styles" value={a.stickerText} onChange={(e) => avatar({ stickerText: e.target.value })} />
                <TextField label="Button" value={a.stickerButton} onChange={(e) => avatar({ stickerButton: e.target.value })} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-fog">Wall posters card</p>
                <TextField label="Title" value={a.wallTitle} onChange={(e) => avatar({ wallTitle: e.target.value })} />
                <TextField label="Text" value={a.wallText} onChange={(e) => avatar({ wallText: e.target.value })} />
                <TextField label="Button" value={a.wallButton} onChange={(e) => avatar({ wallButton: e.target.value })} />
              </div>
            </div>
            <Chips chips={a.chips} onChange={(chips) => avatar({ chips })} />
          </div>
        )}
        {open === "stickers" && (
          <div className="space-y-3">
            <SlidePreview badge={page.stickers.badge} title={page.stickers.title} text={page.stickers.text} button={page.stickers.button} chips={page.stickers.chips} />
            <CopyFields copy={page.stickers} onChange={(stickers) => patch({ stickers })} />
          </div>
        )}
        {open === "posters" && (
          <div className="space-y-3">
            <SlidePreview badge={page.posters.badge} title={page.posters.title} text={page.posters.text} button={page.posters.button} chips={page.posters.chips} />
            <CopyFields copy={page.posters} onChange={(posters) => patch({ posters })} />
          </div>
        )}
        {open === "products" && (
          <div className="space-y-4">
            <div className="divide-y divide-line">
              <Stepper label="Sticker and poster slides" value={page.productSlides} max={12} onChange={(productSlides) => patch({ productSlides })} />
              <Stepper label="Wall set slides" value={page.wallSlides} max={8} onChange={(wallSlides) => patch({ wallSlides })} />
            </div>
            <p className="text-xs text-fog">The shop picks these fresh each day, with Featured and New products more likely.</p>
            <div>
              <p className="mb-2 text-sm font-semibold">Labels on a sticker slide</p>
              <Chips chips={page.stickerChips} onChange={(stickerChips) => patch({ stickerChips })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Labels on a poster or wall slide</p>
              <Chips chips={page.posterChips} onChange={(posterChips) => patch({ posterChips })} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function OrderTab({ page, patch }: { page: HomePage; patch: (change: Partial<HomePage>) => void }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Sections under the banner" hint="Top to bottom, as shoppers scroll.">
        <ul className="divide-y divide-line">
          {page.sections.map((section, i) => (
            <li key={section.id} className="flex items-center gap-2 py-2">
              <span className="w-4 text-xs font-bold text-fog">{i + 1}</span>
              <div className={`min-w-0 flex-1 ${section.visible ? "" : "opacity-50"}`}>
                <p className="truncate text-sm font-semibold">{HOME_SECTIONS[section.id].label}</p>
                <p className="truncate text-xs text-fog">{HOME_SECTIONS[section.id].hint}</p>
              </div>
              <Arrows onUp={() => patch({ sections: move(page.sections, i, i - 1) })} onDown={() => patch({ sections: move(page.sections, i, i + 1) })} />
              <Switch
                on={section.visible}
                label={`Show ${HOME_SECTIONS[section.id].label}`}
                onChange={(on) => patch({ sections: page.sections.map((s) => (s.id === section.id ? { ...s, visible: on } : s)) })}
              />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Wall rows" hint="Rename, reorder or hide. A row with no walls never shows.">
        <TextField label="Main wall row title" value={page.wallsTitle} onChange={(e) => patch({ wallsTitle: e.target.value })} />
        <ul className="mt-2 divide-y divide-line">
          {page.themes.map((theme, i) => (
            <li key={theme.id} className="flex items-center gap-2 py-2">
              <input
                aria-label={`Name of the ${theme.id} row`}
                value={theme.title}
                onChange={(e) => patch({ themes: page.themes.map((t) => (t.id === theme.id ? { ...t, title: e.target.value } : t)) })}
                className={`h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold outline-none hover:border-line focus:border-brand/60 ${theme.visible ? "" : "opacity-50"}`}
              />
              <Arrows onUp={() => patch({ themes: move(page.themes, i, i - 1) })} onDown={() => patch({ themes: move(page.themes, i, i + 1) })} />
              <Switch
                on={theme.visible}
                label={`Show ${theme.title}`}
                onChange={(on) => patch({ themes: page.themes.map((t) => (t.id === theme.id ? { ...t, visible: on } : t)) })}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/** A wall card drawn with the current design, so changes can be judged before saving. */
function CardPreview({ wall, design }: { wall: WallOption | undefined; design: HomePage["wallCard"] }) {
  const paint = wall?.paint?.split(",").join(", ");
  return (
    <div
      className={`mx-auto w-full max-w-64 bg-white p-2 text-[#15161e] ${design.shadow ? "shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]" : ""} ${design.outline ? "ring-1 ring-black/10" : ""}`}
      style={{ borderRadius: design.radius }}
    >
      <div className="relative aspect-square overflow-hidden bg-[#faf9f7]" style={{ borderRadius: Math.max(design.radius - 6, 0) }}>
        {paint && <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${paint})`, opacity: design.tint / 100 }} />}
        {wall && (
          <img
            src={imageSrc(wall.image)}
            alt=""
            className="absolute object-contain"
            style={{ inset: `${design.space}%`, width: `${100 - design.space * 2}%`, height: `${100 - design.space * 2}%` }}
          />
        )}
        {design.discount && <span className="absolute top-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">50% off</span>}
      </div>
      <p className="mt-2 truncate px-1 text-sm font-bold">{wall ? shortName(wall.name) : "Wall"}</p>
      {design.posterCount && <p className="px-1 text-[11px] text-neutral-500">{wall?.posters ?? 6} posters</p>}
      {design.posterSizes && <p className="px-1 text-[11px] font-semibold text-neutral-500">2 pcs 6×9 + 4 pcs 4×6 in</p>}
      <div className="mt-2 flex items-center justify-between px-1 pb-1">
        <span className="text-lg font-bold text-amber-600">₹199</span>
        <span className="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold">{design.button}</span>
      </div>
    </div>
  );
}

/** One wall row as a picture grid: remove any card, pin any to the front, add any wall. */
function RowCards({
  rowId,
  row,
  walls,
  onChange,
}: {
  rowId: string;
  row: WallRowCards;
  walls: WallOption[];
  onChange: (row: WallRowCards) => void;
}) {
  const [query, setQuery] = useState("");
  const own = rowId === WALL_MIX_ROW ? walls : walls.filter((w) => w.theme === rowId);
  const cards = arrangeWallRow(row, own, walls);
  const removed = walls.filter((w) => row.hidden.includes(w.slug));
  const matches = query.trim()
    ? walls.filter((w) => !cards.includes(w) && w.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const without = (slug: string) => row.pinned.filter((s) => s !== slug);
  const nudge = (slug: string, by: number) => {
    const from = row.pinned.indexOf(slug);
    onChange({ ...row, pinned: move(row.pinned, from, from + by) });
  };
  const tool = "grid size-7 place-items-center rounded-full bg-black/70 text-white hover:bg-black";

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fog" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a wall to this row: type its name"
          className="w-full rounded-xl border border-line bg-ink py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand/60"
        />
        {query.trim() && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-ink2 shadow-xl">
            {matches.map((wall) => (
              <li key={wall.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ pinned: [...without(wall.slug), wall.slug], hidden: row.hidden.filter((s) => s !== wall.slug) });
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-white/5"
                >
                  <img src={imageSrc(wall.image)} alt="" className="size-8 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate">{shortName(wall.name)}</span>
                  <Plus className="size-4 text-brand" />
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="p-3 text-sm text-fog">No other walls match.</li>}
          </ul>
        )}
      </div>

      <div className="mt-3 grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((wall) => {
          const pinned = row.pinned.includes(wall.slug);
          return (
            <div key={wall.slug} className={`overflow-hidden rounded-xl border ${pinned ? "border-brand/60" : "border-line"}`}>
              <div className="relative aspect-square bg-ink">
                <img src={imageSrc(wall.image)} alt="" loading="lazy" className="size-full object-contain" />
                <span className="absolute top-1 right-1 flex gap-1">
                  <button
                    type="button"
                    aria-label={pinned ? `Unpin ${wall.name}` : `Pin ${wall.name} to the front`}
                    title={pinned ? "Unpin" : "Pin to the front"}
                    onClick={() => onChange({ ...row, pinned: pinned ? without(wall.slug) : [...row.pinned, wall.slug] })}
                    className={`${tool} ${pinned ? "!bg-brand" : ""}`}
                  >
                    <Pin className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${wall.name} from this row`}
                    title="Remove from this row"
                    onClick={() => onChange({ pinned: without(wall.slug), hidden: own.includes(wall) ? [...row.hidden, wall.slug] : row.hidden })}
                    className={tool}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
                {pinned && (
                  <span className="absolute bottom-1 left-1 flex rounded-full bg-black/70 text-white">
                    <button type="button" aria-label="Move earlier" onClick={() => nudge(wall.slug, -1)} className="grid size-7 place-items-center">
                      <ArrowUp className="size-3.5 -rotate-90" />
                    </button>
                    <button type="button" aria-label="Move later" onClick={() => nudge(wall.slug, 1)} className="grid size-7 place-items-center">
                      <ArrowDown className="size-3.5 -rotate-90" />
                    </button>
                  </span>
                )}
              </div>
              <p className="truncate px-2 py-1.5 text-xs font-medium">{shortName(wall.name)}</p>
            </div>
          );
        })}
        {cards.length === 0 && <p className="col-span-full py-6 text-center text-sm text-fog">No walls in this row yet.</p>}
      </div>

      {removed.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-fog">Removed from this row (click to bring back)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {removed.map((wall) => (
              <button
                key={wall.slug}
                type="button"
                onClick={() => onChange({ ...row, hidden: row.hidden.filter((s) => s !== wall.slug) })}
                className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-fog hover:text-snow"
              >
                <Plus className="size-3" /> {shortName(wall.name)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WallsTab({ page, patch, walls }: { page: HomePage; patch: (change: Partial<HomePage>) => void; walls: WallOption[] }) {
  const [rowId, setRowId] = useState(WALL_MIX_ROW);
  const card = (change: Partial<HomePage["wallCard"]>) => patch({ wallCard: { ...page.wallCard, ...change } });
  const design = page.wallCard;
  const rows = [{ id: WALL_MIX_ROW, title: page.wallsTitle }, ...page.themes];

  return (
    <div className="space-y-4">
      <Panel title="Which walls show in each row" hint="Pick a row. Pinned walls lead it; the rest change order daily.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setRowId(row.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${rowId === row.id ? "border-brand bg-brand/10 text-brand" : "border-line text-fog hover:text-snow"}`}
            >
              {row.title}
            </button>
          ))}
        </div>
        <RowCards
          key={rowId}
          rowId={rowId}
          row={page.wallRows[rowId] ?? { pinned: [], hidden: [] }}
          walls={walls}
          onChange={(row) => patch({ wallRows: { ...page.wallRows, [rowId]: row } })}
        />
      </Panel>

      <Panel title="Card design" hint="Applies to every wall card. The preview updates as you change it.">
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-3">
            <Slider label="Wall colour tint" value={design.tint} min={0} max={100} unit="%" onChange={(tint) => card({ tint })} />
            <Slider label="Space around posters" value={design.space} min={0} max={15} unit="%" onChange={(space) => card({ space })} />
            <Slider label="Corner roundness" value={design.radius} min={0} max={40} unit=" px" onChange={(radius) => card({ radius })} />
            <TextField label="Button text" maxLength={20} value={design.button} onChange={(e) => card({ button: e.target.value })} />
            <div className="grid gap-x-6 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
              <SwitchRow label="Soft shadow" on={design.shadow} onChange={(shadow) => card({ shadow })} />
              <SwitchRow label="Thin outline" on={design.outline} onChange={(outline) => card({ outline })} />
              <SwitchRow label="Discount badge" on={design.discount} onChange={(discount) => card({ discount })} />
              <SwitchRow label="Number of posters" on={design.posterCount} onChange={(posterCount) => card({ posterCount })} />
              <SwitchRow label="Poster sizes line" on={design.posterSizes} onChange={(posterSizes) => card({ posterSizes })} />
              <SwitchRow label="Size labels on posters" on={design.sizeLabels} onChange={(sizeLabels) => card({ sizeLabels })} />
            </div>
          </div>
          <CardPreview wall={walls.find((w) => w.paint) ?? walls[0]} design={design} />
        </div>
      </Panel>
    </div>
  );
}

/** The home page editor: one tab per job, with the rails editor (`children`) as the last tab. */
export default function HomePageEditor({
  initial,
  walls,
  shopUrl,
  children,
}: {
  initial: HomePage;
  walls: WallOption[];
  shopUrl: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("hero");
  const [page, setPage] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(page) !== saved;
  const patch = (change: Partial<HomePage>) => setPage((now) => ({ ...now, ...change }));

  // Reloading the page stays on the same tab.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === hash)) setTab(hash as Tab);
  }, []);

  function open(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/home-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setPage(data.page);
      setSaved(JSON.stringify(data.page));
      toast("Saved — live on the shop now");
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
    <div className="pb-24">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink2 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => open(id)}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap ${
              tab === id ? "bg-panel text-snow" : "text-fog hover:text-snow"
            }`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "hero" && <HeroTab page={page} patch={patch} />}
        {tab === "order" && <OrderTab page={page} patch={patch} />}
        {tab === "walls" && <WallsTab page={page} patch={patch} walls={walls} />}
        {/* stays mounted, so unsaved rail changes survive a tab switch */}
        <div className={tab === "rails" ? "" : "hidden"}>{children}</div>
      </div>

      {tab !== "rails" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={save}
              className="pie-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />} Save changes
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => setPage(JSON.parse(saved))}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-fog hover:text-snow"
              >
                <RotateCcw className="size-3.5" /> Undo
              </button>
            )}
            <span className={`text-xs ${dirty ? "text-gold" : "text-fog"}`}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
            {error && <span className="text-xs text-brand">{error}</span>}
            <button
              type="button"
              onClick={() => {
                if (confirm("Put the hero, page order and wall cards back to their defaults? Save afterwards to apply it.")) setPage(DEFAULT_HOME_PAGE);
              }}
              className="ml-auto text-xs font-semibold text-fog hover:text-snow"
            >
              Reset to default
            </button>
            <a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              View shop <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
