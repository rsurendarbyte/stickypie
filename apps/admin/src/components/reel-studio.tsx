"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Film, Loader2, Pause, Play, Search, Square } from "lucide-react";
import { PUZZLE_POSTER_PRICES, puzzleBuildInches } from "@stickypie/shared";
import { canEncode, encodeReel } from "@/lib/reel/encode";
import { REEL_STYLES, reelStyle } from "@/lib/reel/styles";
import { reelCopy } from "@/lib/reel/copy";
import { JOURNEYS, type JourneyId } from "@/lib/reel/journeys";
import { card } from "@/lib/reel/kit";
import type { ReelInput, ReelKind, ReelProduct } from "@/lib/reel/types";

type Made = { styleId: string; url: string; name: string };

const KINDS: { id: ReelKind; label: string }[] = [
  { id: "puzzle", label: "Puzzle poster" },
  { id: "poster", label: "Wall poster" },
  { id: "wall", label: "Wall set" },
];

export default function ReelStudio({ products, pct }: { products: ReelProduct[]; pct: number }) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"poster" | "wall">("poster");
  const [productId, setProductId] = useState<string | null>(products.find((p) => p.type === "poster" && p.active)?.id ?? null);
  const product = products.find((p) => p.id === productId) ?? null;
  const [kind, setKind] = useState<ReelKind>("puzzle");
  const [styleId, setStyleId] = useState(REEL_STYLES[0].id);
  const [input, setInput] = useState<ReelInput | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; p: number } | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  const abort = useRef<AbortController | null>(null);

  // a wall set is always a wall-set video; a poster is a puzzle or wall poster
  useEffect(() => {
    if (!product) return;
    if (product.type === "wall") setKind("wall");
    else if (kind === "wall") setKind("puzzle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => p.type === show && (!q || `${p.name} ${p.slug} ${p.tags.join(" ")}`.toLowerCase().includes(q))).slice(0, 80);
  }, [products, query, show]);

  // load the pictures for the chosen product
  useEffect(() => {
    if (!product) return;
    let live = true;
    setInput(null);
    setLoadError(null);
    buildInput(product, kind, pct)
      .then((i) => live && setInput(i))
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : "Could not load the pictures"));
    return () => {
      live = false;
    };
  }, [product, kind, pct]);

  const [mode, setMode] = useState<"real" | "animated">("real");
  const style = reelStyle(styleId);
  const copy = useMemo(() => (product ? reelCopy(product, kind, pct, mode === "real" ? "app" : styleId) : null), [product, kind, pct, styleId, mode]);

  async function make(ids: string[]) {
    if (!input || !product) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      for (let i = 0; i < ids.length; i++) {
        const s = reelStyle(ids[i]);
        const label = ids.length > 1 ? `${s.name} (${i + 1}/${ids.length})` : s.name;
        setBusy({ label, p: 0 });
        const blob = await encodeReel((ctx, t) => s.draw(ctx, t, input), s.duration, (p) => setBusy({ label, p }), ctrl.signal);
        const name = `${product.slug}-${kind}-${s.id}.mp4`;
        const url = URL.createObjectURL(blob);
        setMade((m) => [{ styleId: s.id, url, name }, ...m.filter((x) => x.name !== name)]);
        if (ids.length === 1) download(url, name);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) alert(e instanceof Error ? e.message : "Could not make the video");
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }

  const encodeOk = typeof window === "undefined" || canEncode();

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[18rem_1fr_22rem]">
      {/* 1. product */}
      <section className="rounded-2xl border border-line bg-ink2 p-3">
        <h2 className="text-sm font-bold">1 · Product</h2>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-ink p-1 text-xs font-semibold">
          {(["poster", "wall"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setShow(t)} className={`rounded-md py-1.5 ${show === t ? "bg-brand text-white" : "text-fog"}`}>
              {t === "poster" ? "Mini posters" : "Wall sets"}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-ink px-2.5 py-2">
          <Search className="size-4 shrink-0 text-fog" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posters" className="w-full bg-transparent text-sm text-snow outline-none" />
        </label>
        <ul className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-16rem)]">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setProductId(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-left ${p.id === productId ? "bg-brand/20 ring-1 ring-brand" : "hover:bg-ink"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" className="h-12 w-9 shrink-0 rounded bg-ink object-cover" loading="lazy" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-fog">{p.active ? (p.type === "wall" ? `${p.wall?.posters.length ?? 0} posters` : p.categories[0] ?? "Mini poster") : "Hidden from shop"}</span>
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-2 text-xs text-fog">Nothing matches.</li>}
        </ul>
      </section>

      {/* 2. style + preview */}
      <section className="rounded-2xl border border-line bg-ink2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold">2 · Video</h2>
          <div className="ml-auto flex gap-1 rounded-lg bg-ink p-1 text-xs font-semibold">
            {KINDS.filter((k) => (product?.type === "wall" ? k.id === "wall" : k.id !== "wall")).map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} className={`rounded-md px-3 py-1.5 ${kind === k.id ? "bg-brand text-white" : "text-fog"}`}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-ink p-1 text-xs font-semibold">
          <button type="button" onClick={() => setMode("real")} className={`rounded-md py-1.5 ${mode === "real" ? "bg-brand text-white" : "text-fog"}`}>
            Real app recording
          </button>
          <button type="button" onClick={() => setMode("animated")} className={`rounded-md py-1.5 ${mode === "animated" ? "bg-brand text-white" : "text-fog"}`}>
            Animated styles
          </button>
        </div>
        {mode === "real" ? (
          product && <RealRecorder product={product} kind={kind} input={input} />
        ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
          <Preview input={input} styleId={styleId} error={loadError} />
          <div>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-2">
              {REEL_STYLES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  className={`flex gap-2 rounded-xl border p-2 text-left ${s.id === styleId ? "border-brand bg-brand/10" : "border-line bg-ink hover:border-fog/50"}`}
                >
                  <Thumb input={input} styleId={s.id} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {i + 1}. {s.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-fog">{s.blurb}</span>
                    <span className="mt-1 block text-[11px] text-fog">{s.duration}s</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {busy ? (
                <>
                  <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-line bg-ink px-3 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="truncate">Making {busy.label}…</span>
                    <span className="ml-auto tabular-nums text-fog">{Math.round(busy.p * 100)}%</span>
                  </div>
                  <button type="button" onClick={() => abort.current?.abort()} className="flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold">
                    <Square className="size-4" /> Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!input || !encodeOk}
                    onClick={() => make([styleId])}
                    className="pie-gradient flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <Film className="size-4" /> Make video
                  </button>
                  <button
                    type="button"
                    disabled={!input || !encodeOk}
                    onClick={() => make(REEL_STYLES.map((s) => s.id))}
                    className="flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-40"
                  >
                    Make all 10
                  </button>
                </>
              )}
            </div>
            {!encodeOk && <p className="mt-2 text-xs text-brand">This browser can&apos;t make videos. Open the admin in Chrome or Edge on a computer.</p>}
            {made.length > 0 && (
              <ul className="mt-3 space-y-1">
                {made.map((m) => (
                  <li key={m.name} className="flex items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-xs">
                    <Check className="size-3.5 text-emerald-400" />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <button type="button" onClick={() => download(m.url, m.name)} className="flex items-center gap-1 font-semibold text-brand">
                      <Download className="size-3.5" /> Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-fog">
              Videos are silent: add a trending sound or your voice in Instagram / YouTube when you post. {style.duration}s, 1080 × 1920, 30 fps.
            </p>
          </div>
        </div>
        )}
      </section>

      {/* 3. words */}
      <section className="rounded-2xl border border-line bg-ink2 p-3">
        <h2 className="text-sm font-bold">3 · Post & ad text</h2>
        {copy ? <CopyPanel copy={copy} /> : <p className="mt-2 text-xs text-fog">Pick a product.</p>}
      </section>
    </div>
  );
}

/**
 * Real app recording: Chrome on this Mac plays a shopper's path on the shop
 * (solve, win, share, add to cart…) and films the phone screen. Only the
 * admin running on the Mac can do it.
 */
function RealRecorder({ product, kind, input }: { product: ReelProduct; kind: ReelKind; input: ReelInput | null }) {
  const journeys = JOURNEYS.filter((j) => j.for.includes(kind));
  const [journey, setJourney] = useState<JourneyId>(journeys[0]?.id ?? "play-win-cart");
  const [site, setSite] = useState<"dev" | "live">("live");
  const [cards, setCards] = useState(true);
  // where the hook / "link in bio" cards sit on the recording, so they don't cover the poster
  const [hookAt, setHookAt] = useState<TagSpot>("top");
  const [ctaAt, setCtaAt] = useState<TagSpot>("bottom");
  const [ready, setReady] = useState<{ ok: boolean; problem: string | null } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    if (!journeys.some((j) => j.id === journey)) setJourney(journeys[0]?.id ?? "play-win-cart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  useEffect(() => {
    fetch("/api/reel-record")
      .then((r) => r.json())
      .then(setReady)
      .catch(() => setReady({ ok: false, problem: "Recording only works in the admin running on your Mac." }));
  }, []);
  useEffect(() => {
    if (busy === null) return;
    const t = setInterval(() => setBusy((s) => (s === null ? s : s + 1)), 1000);
    return () => clearInterval(t);
  }, [busy === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function record(ids: JourneyId[]) {
    setError(null);
    for (const id of ids) {
      setBusy(0);
      try {
        const body = {
          journey: id,
          slug: product.slug,
          site,
          hookPng: cards && input && hookAt !== "off" ? cardPng(input, [{ text: input.hook[0] }, { text: input.hook[1] }], hookAt) : null,
          ctaPng: cards && input && ctaAt !== "off" ? cardPng(input, [{ text: input.cta[0] }, { text: input.cta[1] }], ctaAt) : null,
        };
        const res = await fetch("/api/reel-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Recording failed (${res.status})`);
        const url = URL.createObjectURL(await res.blob());
        const name = `${product.slug}-${id}-${site}.mp4`;
        setVideos((v) => [{ name, url }, ...v.filter((x) => x.name !== name)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Recording failed");
        break;
      }
    }
    setBusy(null);
  }

  const latest = videos[0];
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
      <div className="mx-auto w-[16.875rem]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink ring-1 ring-line">
          {latest ? (
            <video key={latest.url} src={latest.url} controls autoPlay muted loop playsInline className="size-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-fog">
              {busy !== null ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Recording the shop… {busy}s
                  <span>Takes about 20–45 seconds.</span>
                </>
              ) : (
                "Your recording shows here."
              )}
            </div>
          )}
        </div>
        {latest && <p className="mt-2 truncate text-center text-xs text-fog">{latest.name}</p>}
      </div>
      <div>
        <div className="space-y-2">
          {journeys.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJourney(j.id)}
              className={`block w-full rounded-xl border p-2.5 text-left ${j.id === journey ? "border-brand bg-brand/10" : "border-line bg-ink hover:border-fog/50"}`}
            >
              <span className="block text-sm font-semibold">{j.name}</span>
              <span className="mt-0.5 block text-xs text-fog">{j.blurb}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex gap-1 rounded-lg bg-ink p-1 font-semibold">
            {(["live", "dev"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSite(s)} className={`rounded-md px-3 py-1.5 ${site === s ? "bg-brand text-white" : "text-fog"}`}>
                {s === "live" ? "Live shop" : "Dev shop"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-fog">
            <input type="checkbox" checked={cards} onChange={(e) => setCards(e.target.checked)} className="accent-[#f26b1d]" />
            Hook and &quot;link in bio&quot; cards
          </label>
        </div>
        {cards && (
          <div className="mt-2 space-y-1.5 text-xs">
            <TagSpotPicker label="Hook tag" value={hookAt} onChange={setHookAt} />
            <TagSpotPicker label="Link in bio tag" value={ctaAt} onChange={setCtaAt} />
          </div>
        )}
        <p className="mt-2 text-xs text-fog">
          {site === "live"
            ? "Live shows your real prices. The recording adds this poster to a cart, so a pending cart will show under Carts."
            : "Dev is safe to play on, but its prices and products can differ from the live shop."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null || !ready?.ok}
            onClick={() => record([journey])}
            className="pie-gradient flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy !== null ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />} {busy !== null ? `Recording… ${busy}s` : "Record video"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !ready?.ok}
            onClick={() => record(journeys.map((j) => j.id))}
            className="flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-40"
          >
            Record all {journeys.length}
          </button>
        </div>
        {ready && !ready.ok && <p className="mt-2 text-xs text-brand">{ready.problem}</p>}
        {error && <p className="mt-2 text-xs text-brand">{error}</p>}
        {videos.length > 0 && (
          <ul className="mt-3 space-y-1">
            {videos.map((m) => (
              <li key={m.name} className="flex items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-xs">
                <Check className="size-3.5 text-emerald-400" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <button type="button" onClick={() => download(m.url, m.name)} className="flex items-center gap-1 font-semibold text-brand">
                  <Download className="size-3.5" /> Download
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-fog">Silent 1080 × 1920 video of the real shop on a phone. Add your sound in Instagram / YouTube.</p>
      </div>
    </div>
  );
}

/** A transparent 1080 × 1920 PNG with the sticker-style text cards, laid over the recording. */
function cardPng(input: ReelInput, lines: { text: string }[], spot: Exclude<TagSpot, "off">): string {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  card(c.getContext("2d")!, input, lines, TAG_Y[spot], 1);
  return c.toDataURL("image/png");
}

/** Where a text card sits on the 1080 × 1920 recording ("off" leaves it out). */
type TagSpot = "top" | "middle" | "bottom" | "off";
/** Top edge of the card (two lines, about 250 px tall) for each spot. */
const TAG_Y: Record<Exclude<TagSpot, "off">, number> = { top: 40, middle: 830, bottom: 1560 };
const TAG_SPOTS: { id: TagSpot; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
  { id: "off", label: "Off" },
];

function TagSpotPicker({ label, value, onChange }: { label: string; value: TagSpot; onChange: (v: TagSpot) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-fog">{label}</span>
      <div className="flex gap-1 rounded-lg bg-ink p-1 font-semibold">
        {TAG_SPOTS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-md px-2.5 py-1 ${value === o.id ? "bg-brand text-white" : "text-fog"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The chosen style playing on a loop. */
function Preview({ input, styleId, error }: { input: ReelInput | null; styleId: string; error: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const style = reelStyle(styleId);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !input) return;
    let raf = 0;
    let start = performance.now() - time * 1000;
    const loop = (now: number) => {
      const t = ((now - start) / 1000) % style.duration;
      style.draw(ctx, t, input);
      setTime(t);
      if (playing) raf = requestAnimationFrame(loop);
    };
    if (playing) raf = requestAnimationFrame(loop);
    else {
      start = performance.now();
      style.draw(ctx, time, input);
    }
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, styleId, playing]);
  return (
    <div className="mx-auto w-[16.875rem]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink ring-1 ring-line">
        <canvas ref={ref} width={1080} height={1920} className="size-full" />
        {!input && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-fog">
            {error ?? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading pictures…
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-fog">
        <button type="button" onClick={() => setPlaying((v) => !v)} className="flex size-8 items-center justify-center rounded-lg border border-line" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={style.duration}
          step={0.05}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            const t = Number(e.target.value);
            setTime(t);
            const ctx = ref.current?.getContext("2d");
            if (ctx && input) style.draw(ctx, t, input);
          }}
          className="flex-1 accent-[var(--color-brand,#f26b1d)]"
        />
        <span className="w-10 text-right tabular-nums">{time.toFixed(1)}s</span>
      </div>
    </div>
  );
}

/** A still from a style, for its button. */
function Thumb({ input, styleId }: { input: ReelInput | null; styleId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!input || !ref.current) return;
    const style = reelStyle(styleId);
    const big = document.createElement("canvas");
    big.width = 1080;
    big.height = 1920;
    const bctx = big.getContext("2d")!;
    style.draw(bctx, THUMB_AT[styleId] ?? style.duration * 0.4, input);
    const ctx = ref.current.getContext("2d")!;
    ctx.drawImage(big, 0, 0, ref.current.width, ref.current.height);
  }, [input, styleId]);
  return <canvas ref={ref} width={108} height={192} className="h-24 w-[3.375rem] shrink-0 rounded-md bg-ink" />;
}

const THUMB_AT: Record<string, number> = { solve: 3.4, peel: 2.6, details: 3.2, "wall-build": 4.5, sizes: 2.8, "fast-cuts": 1.6, "before-after": 3.0, "price-tag": 3.2, deal: 3.4, editorial: 3 };

function CopyPanel({ copy }: { copy: NonNullable<ReturnType<typeof reelCopy>> }) {
  const [tab, setTab] = useState<"ig" | "yt" | "ad" | "aud">("ig");
  const tabs = [
    { id: "ig", label: "Instagram" },
    { id: "yt", label: "YouTube" },
    { id: "ad", label: "Ad setup" },
    { id: "aud", label: "Audiences" },
  ] as const;
  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-ink p-1 text-[11px] font-semibold">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`rounded-md py-1.5 ${tab === t.id ? "bg-brand text-white" : "text-fog"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-3 text-sm">
        {tab === "ig" && <Block label="Caption" value={copy.caption} />}
        {tab === "yt" && (
          <>
            <Block label={`Title (${copy.youtube.title.length}/100)`} value={copy.youtube.title} />
            <Block label="Description" value={copy.youtube.description} />
            <Block label="Tags" value={copy.youtube.tags.join(", ")} />
          </>
        )}
        {tab === "ad" && (
          <>
            {copy.ad.warnings.map((w) => (
              <p key={w} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                {w}
              </p>
            ))}
            <Block label="Primary text" value={copy.ad.primary} />
            <Block label="Headline" value={copy.ad.headline} />
            <Block label="Description" value={copy.ad.description} />
            <Block label="Button" value={copy.ad.cta} />
            <Block label="Website link (with tracking)" value={copy.link} />
            <div>
              <p className="text-xs font-semibold text-fog">Settings</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                {copy.ad.settings.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </>
        )}
        {tab === "aud" && (
          <>
            <p className="text-xs text-fog">One ad set per segment, same videos in each. Budget split is a starting point for testing.</p>
            {copy.segments.map((s) => (
              <div key={s.name} className="rounded-xl border border-line bg-ink p-2.5">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-bold">{s.name}</p>
                  <span className="ml-auto shrink-0 text-xs font-semibold text-brand">{s.budget}</span>
                </div>
                <p className="mt-0.5 text-xs text-fog">
                  {s.who} · age {s.age}
                </p>
                <p className="mt-1.5 flex flex-wrap gap-1">
                  {s.interests.map((i) => (
                    <span key={i} className="rounded-md bg-ink2 px-1.5 py-0.5 text-[11px]">
                      {i}
                    </span>
                  ))}
                </p>
                {s.note && <p className="mt-1.5 text-xs text-fog">{s.note}</p>}
              </div>
            ))}
            <CopyButton value={copy.segments.map((s) => `${s.name}\n${s.who}\nAge ${s.age}\nInterests: ${s.interests.join(", ")}\nBudget: ${s.budget}${s.note ? `\n${s.note}` : ""}`).join("\n\n")} label="Copy all segments" />
          </>
        )}
      </div>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-fog">{label}</p>
        <CopyButton value={value} />
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-ink p-2 text-xs leading-relaxed">{value}</p>
    </div>
  );
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="ml-auto flex items-center gap-1 text-xs font-semibold text-brand"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/** Loads a picture through the admin's same-origin image route, so the canvas can be exported. */
async function loadArt(url: string): Promise<ImageBitmap> {
  const res = await fetch(`/api/image-download?${new URLSearchParams({ url })}`);
  if (!res.ok) throw new Error(`Could not load a picture (${res.status})`);
  return createImageBitmap(await res.blob());
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000 + 0.00001;
}

const sizeLabel = (inches: number) => (inches === 6 ? "4×6 IN" : inches === 9 ? "6×9 IN" : `${inches} IN`);

async function buildInput(product: ReelProduct, kind: ReelKind, pct: number): Promise<ReelInput> {
  const [art, posters] = await Promise.all([
    loadArt(product.image),
    kind === "wall" && product.wall ? Promise.all(product.wall.posters.map(async (p) => ({ art: await loadArt(p.image), inches: p.inches }))) : Promise.resolve([]),
  ]);
  await document.fonts.ready;
  const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-fredoka").trim() || "sans-serif";
  const prices =
    kind === "puzzle"
      ? Object.entries(PUZZLE_POSTER_PRICES).map(([card, price]) => {
          const b = puzzleBuildInches(Number(card));
          return { label: `${(b * 2) / 3}×${b} IN`, price, was: null };
        })
      : kind === "wall"
        ? [{ label: "WALL SET", price: product.price, was: product.was }]
        : (product.sizes.length ? product.sizes : [{ inches: 6, price: 60, was: null }]).map((s) => ({ label: sizeLabel(s.inches), price: s.price, was: s.was }));
  const from = Math.min(...prices.map((p) => p.price));
  return {
    kind,
    name: product.name.replace(/\s*mini poster\s*$/i, "").replace(/\s*\d+ Mini Poster Pack\s*$/i, "").trim(),
    art,
    posters,
    spots: product.wall?.spots ?? null,
    paint: product.wall?.paint ?? ["#ece6dd", "#d9d0c4"],
    feet: product.wall?.feet ?? null,
    pct,
    prices,
    from,
    hook: kind === "puzzle" ? ["SOLVE IT", `SAVE [${pct}%]`] : kind === "wall" ? ["ONE BOX", "WHOLE WALL"] : ["YOUR WALL", "NEEDS THIS"],
    cta: ["LINK IN BIO", kind === "puzzle" ? "GO SOLVE IT" : "SHOP NOW"],
    font: fam,
    seed: hash(product.slug),
  };
}
