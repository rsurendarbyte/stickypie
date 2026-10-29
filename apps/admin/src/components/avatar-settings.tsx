"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Loader2, Plus, Shuffle, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  AVATAR_MAX_COVERS,
  AVATAR_MAX_PAGES,
  AVATAR_MAX_POSE_SETS,
  AVATAR_MAX_STYLE_IMAGES,
  AVATAR_MAX_STYLES,
  AVATAR_POSES_MAX,
  type AvatarStyle,
} from "@stickypie/shared";
import {
  avatarAllPoses,
  avatarCardPrompt,
  avatarPoseSets,
  avatarSheetPrompt,
  nextPoseSet,
} from "@/lib/avatar-prompts";
import { imageSrc } from "@/lib/img";
import { TextField } from "./field";

const digits = (v: string) => v.replace(/\D/g, "");

/** One prompt with its Copy button. */
function PromptBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-ink2 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{title}</span>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-snow px-2.5 text-[11px] font-semibold text-ink"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-fog select-all">
        {text}
      </p>
    </div>
  );
}

/**
 * A style's AI image prompts: the two card pictures, then its sheet sets as
 * tabs (Set 1, Set 2… + Add set). Each set has its own poses — editable, saved
 * with the style — and girl, boy and client-photo prompts.
 */
function StylePrompts({
  style,
  onPoseSets,
}: {
  style: AvatarStyle;
  onPoseSets: (next: string[]) => void;
}) {
  const label = style.label.trim() || "New style";
  const sets = avatarPoseSets(style);
  const [tab, setTab] = useState(0);
  const at = Math.min(tab, sets.length - 1);
  const poses = sets[at];
  // Card picture pose: "" = the style's own card pose, else one from its sets.
  const allPoses = avatarAllPoses(sets);
  const [cardPose, setCardPose] = useState("");

  const edit = (next: string[]) => onPoseSets(next);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`card-pose-${label}`} className="text-xs font-semibold">
          Card picture pose
        </label>
        <select
          id={`card-pose-${label}`}
          value={cardPose}
          onChange={(e) => setCardPose(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-ink2 px-2 text-xs outline-none focus:border-snow/40"
        >
          <option value="">Style default</option>
          {allPoses.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const others = allPoses.filter((p) => p !== cardPose);
            if (others.length) setCardPose(others[Math.floor(Math.random() * others.length)]);
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold text-snow"
        >
          <Shuffle className="size-3.5" /> Random
        </button>
      </div>
      <PromptBlock
        title="Girl card picture"
        text={avatarCardPrompt(label, "girl", cardPose)}
      />
      <PromptBlock
        title="Boy card picture"
        text={avatarCardPrompt(label, "boy", cardPose)}
      />

      <div
        className="flex flex-wrap items-center gap-1 border-b border-line pt-1"
        role="tablist"
        aria-label="Sheet sets"
      >
        {sets.map((_, n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === at}
            onClick={() => setTab(n)}
            className={`-mb-px h-8 rounded-t-lg border px-3 text-xs font-semibold ${
              n === at
                ? "border-line border-b-ink bg-ink text-snow"
                : "border-transparent text-fog hover:text-snow"
            }`}
          >
            Set {n + 1}
          </button>
        ))}
        {sets.length < AVATAR_MAX_POSE_SETS && (
          <button
            type="button"
            onClick={() => {
              edit([...sets, nextPoseSet(sets)]);
              setTab(sets.length);
            }}
            className="-mb-px inline-flex h-8 items-center gap-1 px-2.5 text-xs font-semibold text-fog hover:text-snow"
          >
            <Plus className="size-3.5" /> Add set
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`poses-${label}-${at}`}
            className="text-xs font-semibold"
          >
            Set {at + 1} poses{" "}
            <span className="font-normal text-fog">(9, comma-separated)</span>
          </label>
          {sets.length > 1 && (
            <button
              type="button"
              onClick={() => {
                edit(sets.filter((_, n) => n !== at));
                setTab(Math.max(0, at - 1));
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-fog hover:text-brand"
            >
              <Trash2 className="size-3.5" /> Remove set {at + 1}
            </button>
          )}
        </div>
        <textarea
          id={`poses-${label}-${at}`}
          value={poses}
          onChange={(e) =>
            edit(sets.map((p, n) => (n === at ? e.target.value : p)))
          }
          maxLength={AVATAR_POSES_MAX}
          rows={3}
          className="mt-1 w-full rounded-lg border border-line bg-ink2 px-3 py-2 text-xs outline-none focus:border-snow/40"
        />
      </div>
      <PromptBlock
        title={`Girl sheet · set ${at + 1}`}
        text={avatarSheetPrompt(label, "girl", sets, at)}
      />
      <PromptBlock
        title={`Boy sheet · set ${at + 1}`}
        text={avatarSheetPrompt(label, "boy", sets, at)}
      />
      <PromptBlock
        title={`With client photo · set ${at + 1} (for orders — attach their photo)`}
        text={avatarSheetPrompt(label, "photo", sets, at)}
      />
      <PromptBlock
        title={`With couple photo · set ${at + 1} (for couple orders — attach their photo)`}
        text={avatarSheetPrompt(label, "photo", sets, at, "", true)}
      />
      <p className="text-[11px] text-fog">
        Samples: make the girl one first, then attach it when making the boy one
        so both match. Upload card pictures with the card picture buttons,
        sheets with Add samples. New sets and pose edits are kept when you click
        Save. Orders: each avatar order has a copy button per set (with the
        client&apos;s note) — attach the client&apos;s photo and paste.
      </p>
    </div>
  );
}

/**
 * Admin → Avatar sheets: the minimum sheets (one per style) and the price per sheet, and the styles the
 * shopper picks from (one per sheet) — each with card pictures (a girl and a
 * boy, rotated on the style card) and sample sheets, shown on the maker and in
 * the home banner wall.
 */
export default function AvatarSettings({
  pages,
  onPages,
  price,
  onPrice,
  extra,
  onExtra,
  styles,
  onStyles,
}: {
  pages: string;
  onPages: (next: string) => void;
  price: string;
  onPrice: (next: string) => void;
  extra: string;
  onExtra: (next: string) => void;
  styles: AvatarStyle[];
  onStyles: (next: AvatarStyle[]) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  // Which style's AI prompts are open.
  const [promptsFor, setPromptsFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Which style, and whether the pick is card picture `slot` or more samples.
  const target = useRef<{ i: number; kind: "cover" | "samples"; slot: number }>(
    { i: 0, kind: "samples", slot: 0 },
  );

  const set = (i: number, patch: Partial<AvatarStyle>) =>
    onStyles(styles.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: number) => {
    const next = [...styles];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onStyles(next);
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const { i, kind, slot } = target.current;
    setBusy(i);
    setError(null);
    const added: string[] = [];
    const room =
      kind === "cover" ? 1 : AVATAR_MAX_STYLE_IMAGES - styles[i].images.length;
    for (const file of Array.from(files).slice(0, room)) {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) {
        setError(data.error ?? "Upload failed");
        break;
      }
      added.push(data.url);
    }
    if (kind === "cover") {
      if (added[0]) {
        const covers = [...styles[i].covers];
        covers[slot] = added[0];
        set(i, { covers: covers.filter(Boolean) });
      }
    } else set(i, { images: [...styles[i].images, ...added] });
    setBusy(null);
  }

  const pick = (i: number, kind: "cover" | "samples", slot = 0) => {
    target.current = { i, kind, slot };
    input.current?.click();
  };

  return (
    <>
      <div className="grid max-w-xl grid-cols-3 gap-2">
        <TextField
          label="Minimum packs (styles)"
          value={pages}
          onChange={(e) => onPages(digits(e.target.value))}
          inputMode="numeric"
          hint={`1–${AVATAR_MAX_PAGES}`}
        />
        <TextField
          label="Price per pack (₹)"
          value={price}
          onChange={(e) => onPrice(digits(e.target.value))}
          inputMode="numeric"
          hint="For the minimum packs"
        />
        <TextField
          label="Price per extra pack (₹)"
          value={extra}
          onChange={(e) => onExtra(digits(e.target.value))}
          inputMode="numeric"
          hint="Each pack after the minimum"
        />
      </div>
      <p className="mt-1 text-xs text-fog">
        Price 0 stops offering it. Extra pack price empty or 0 = same as the price per pack.
      </p>

      <h3 className="mt-6 text-sm font-semibold">Styles shoppers pick from</h3>
      <p className="mt-0.5 text-xs text-fog">
        Trending looks (90s retro, anime, action figure…). For each style: up to{" "}
        {AVATAR_MAX_COVERS} <b>card pictures</b> — one avatar sticker each in
        that look, e.g. a girl and a boy (square, transparent PNG is best),
        which take turns on the style card — and <b>samples</b>, full sticker
        sheets (e.g. a girl&apos;s and a boy&apos;s, up to{" "}
        {AVATAR_MAX_STYLE_IMAGES}) shown when shoppers tap Samples. Shown in
        this order. Click Save after changes.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        multiple
        className="sr-only"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="mt-2 text-xs font-semibold text-brand">{error}</p>
      )}
      <ul className="mt-3 space-y-2">
        {styles.map((s, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-xl border border-line bg-ink p-2"
          >
            <div className="flex shrink-0 gap-1.5">
              {Array.from(
                { length: Math.min(s.covers.length + 1, AVATAR_MAX_COVERS) },
                (_, slot) => {
                  const url = s.covers[slot];
                  return (
                    <div key={slot} className="text-center">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => pick(i, "cover", slot)}
                        title={
                          url ? "Change card picture" : "Upload card picture"
                        }
                        className="relative grid size-20 place-items-center overflow-hidden rounded-lg bg-panel ring-1 ring-line hover:ring-snow/40"
                      >
                        {url ? (
                          <img
                            src={imageSrc(url)}
                            alt=""
                            className="size-full object-contain"
                          />
                        ) : (
                          <Upload className="size-5 text-fog" />
                        )}
                      </button>
                      <span className="mt-1 block text-[10px] text-fog">
                        {slot ? "Card picture 2" : "Card picture"}
                      </span>
                      {url && (
                        <button
                          type="button"
                          onClick={() =>
                            set(i, {
                              covers: s.covers.filter((_, j) => j !== slot),
                            })
                          }
                          className="text-[10px] font-semibold text-fog hover:text-brand"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                },
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={s.label}
                onChange={(e) => set(i, { label: e.target.value })}
                maxLength={30}
                placeholder="Style name"
                aria-label="Style name"
                className="h-9 w-full rounded-lg border border-line bg-ink2 px-3 text-sm outline-none focus:border-snow/40"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.images.map((url) => (
                  <span
                    key={url}
                    className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-line"
                  >
                    <img
                      src={imageSrc(url)}
                      alt=""
                      className="size-full object-cover object-top"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(i, { images: s.images.filter((u) => u !== url) })
                      }
                      aria-label="Remove sample"
                      className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-brand text-white shadow"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  disabled={
                    busy !== null || s.images.length >= AVATAR_MAX_STYLE_IMAGES
                  }
                  onClick={() => pick(i, "samples")}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${
                    s.images.length
                      ? "border border-line text-snow"
                      : "bg-snow text-ink"
                  }`}
                >
                  {busy === i ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {s.images.length ? "Add more" : "Add samples"}
                </button>
                <button
                  type="button"
                  onClick={() => setPromptsFor(promptsFor === i ? null : i)}
                  aria-expanded={promptsFor === i}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-snow"
                >
                  <Sparkles className="size-3.5" /> AI prompts
                </button>
                {!s.covers.length && !s.images.length && (
                  <span className="text-[11px] text-gold">
                    Nothing yet — shoppers see a drawn stand-in
                  </span>
                )}
              </div>
              {promptsFor === i && (
                <StylePrompts
                  style={s}
                  onPoseSets={(poseSets) => set(i, { poseSets })}
                />
              )}
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
                className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/10 hover:text-snow disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                disabled={i === styles.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
                className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/10 hover:text-snow disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onStyles(styles.filter((_, j) => j !== i))}
                aria-label="Remove style"
                className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/10 hover:text-brand"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={styles.length >= AVATAR_MAX_STYLES}
        onClick={() =>
          onStyles([...styles, { label: "", covers: [], images: [] }])
        }
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-snow hover:underline disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Add a style
      </button>
      {styles.length < Number(pages) && (
        <p className="mt-2 text-xs font-semibold text-gold">
          Add at least {pages} styles — the packs are hidden from shoppers
          until there are enough styles.
        </p>
      )}
    </>
  );
}
