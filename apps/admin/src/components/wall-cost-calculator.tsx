"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { costPerSheet, sheetRate, wallCost, type SheetRate, type WallCosts } from "@stickypie/shared";
import { PAPERS, sheetsNeeded } from "@stickypie/shared/wall-sheets";
import { imageSrc } from "@/lib/img";
import { useToast } from "./toast";

export type CostWall = {
  id: string;
  name: string;
  image: string;
  price: number;
  hidden: boolean;
  /** Each poster's longest side in inches. */
  inches: number[];
};

type Sort = "margin" | "margin-high" | "posters" | "name";

const SORTS: { id: Sort; label: string }[] = [
  { id: "margin", label: "Lowest margin first" },
  { id: "margin-high", label: "Highest margin first" },
  { id: "posters", label: "Most posters first" },
  { id: "name", label: "Name" },
];

const rupees = (n: number) => `₹${n.toFixed(n % 1 ? 2 : 0)}`;
const whole = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(Math.round(n))}`;

/** A number box that lets you type freely ("1." on the way to "1.5") and passes on a clean number. */
function Amount({ label, value, step = 0.5, onChange }: { label: string; value: number; step?: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="text-xs text-fog">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(Math.max(0, Number(e.target.value) || 0));
        }}
        className="mt-1 h-9 w-full rounded-lg border border-line bg-ink px-2 text-sm text-snow outline-none"
      />
    </label>
  );
}

function sizesLabel(inches: number[]) {
  const big = inches.filter((n) => n === 9).length;
  const small = inches.length - big;
  return [big && `${big} × 6×9`, small && `${small} × 4×6`].filter(Boolean).join(" + ");
}

export default function WallCostCalculator({ walls, initial }: { walls: CostWall[]; initial: WallCosts }) {
  const { toast } = useToast();
  const [costs, setCosts] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("margin");

  const paper = PAPERS.find((p) => p.id === costs.paper) ?? PAPERS[0];
  const rate = sheetRate(costs, paper);
  const oneSheet = costPerSheet(costs, rate);
  const dirty = JSON.stringify(costs) !== saved;

  function setRate(change: Partial<SheetRate>) {
    setCosts((now) => ({ ...now, rates: { ...now.rates, [paper.id]: { ...rate, ...change } } }));
  }

  // Walls share a few mixes of sizes, so each mix is packed once.
  const rows = useMemo(() => {
    const packed = new Map<string, number | null>();
    return walls.map((wall) => {
      const key = [...wall.inches].sort().join();
      if (!packed.has(key)) packed.set(key, sheetsNeeded(wall.inches, paper, costs.area));
      const sheets = packed.get(key) ?? null;
      const cost = sheets === null ? null : wallCost(costs, rate, sheets, wall.inches.length);
      return { wall, sheets, cost, margin: cost === null ? null : wall.price - cost };
    });
  }, [walls, costs, paper, rate]);

  const singles = useMemo(
    () =>
      [6, 9].map((inches) => {
        const fit = 24 / (sheetsNeeded(Array(24).fill(inches), paper, costs.area) ?? Infinity);
        return { label: inches === 6 ? "4 × 6" : "6 × 9", fit: Math.floor(fit), cost: fit >= 1 ? oneSheet / Math.floor(fit) + costs.gluePerPoster : null };
      }),
    [paper, costs.area, costs.gluePerPoster, oneSheet]
  );

  const priced = rows.filter((r) => r.margin !== null && r.wall.price > 0);
  const average = priced.length ? priced.reduce((sum, r) => sum + (r.margin ?? 0) / r.wall.price, 0) / priced.length : null;
  const atLoss = priced.filter((r) => (r.margin ?? 0) < 0).length;

  const shown = rows
    .filter((r) => r.wall.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.wall.name.localeCompare(b.wall.name);
      if (sort === "posters") return b.wall.inches.length - a.wall.inches.length;
      // Walls that don't fit go last either way.
      const gap = (r: typeof a) => r.margin ?? (sort === "margin" ? Infinity : -Infinity);
      return sort === "margin" ? gap(a) - gap(b) : gap(b) - gap(a);
    });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/wall-costs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(costs),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setSaved(JSON.stringify(costs));
      toast("Costs saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-2xl border border-line bg-ink2 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="col-span-2 text-xs text-fog sm:col-span-1">
            Paper
            <select
              value={paper.id}
              onChange={(e) => setCosts((now) => ({ ...now, paper: e.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-ink px-2 text-sm text-snow outline-none"
            >
              {PAPERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <Amount key={`sheet-${paper.id}`} label={`${paper.name} sheet ₹`} value={rate.sheet} onChange={(sheet) => setRate({ sheet })} />
          <Amount key={`print-${paper.id}`} label="Print a sheet ₹" value={rate.print} onChange={(print) => setRate({ print })} />
          <Amount label="Wastage %" step={1} value={costs.wastage} onChange={(wastage) => setCosts((now) => ({ ...now, wastage: Math.min(100, wastage) }))} />
          <Amount label="Cut a sheet ₹" value={costs.cutPerSheet} onChange={(cutPerSheet) => setCosts((now) => ({ ...now, cutPerSheet }))} />
          <Amount label="Glue a poster ₹" value={costs.gluePerPoster} onChange={(gluePerPoster) => setCosts((now) => ({ ...now, gluePerPoster }))} />
          <Amount label="Pack a set ₹" value={costs.packingPerSet} onChange={(packingPerSet) => setCosts((now) => ({ ...now, packingPerSet }))} />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="max-w-full">
            <p className="text-xs font-semibold text-fog">Cricut margins (inches)</p>
            <div className="mt-1 grid w-72 max-w-full grid-cols-4 gap-2">
              {(["left", "right", "top", "bottom"] as const).map((side) => (
                <Amount key={side} label={side[0].toUpperCase() + side.slice(1)} step={0.05} value={costs.area[side]} onChange={(n) => setCosts((now) => ({ ...now, area: { ...now.area, [side]: n } }))} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="pie-gradient ml-auto flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-ink2 px-3 py-2">
          <p className="text-xs text-fog">One sheet, all in</p>
          <p className="text-lg font-bold">{rupees(Math.round(oneSheet * 100) / 100)}</p>
        </div>
        <div className="rounded-xl border border-line bg-ink2 px-3 py-2">
          <p className="text-xs text-fog">Average margin</p>
          <p className="text-lg font-bold">{average === null ? "—" : `${Math.round(average * 100)}%`}</p>
          {atLoss > 0 && <p className="text-xs font-semibold text-brand">{atLoss} sold at a loss</p>}
        </div>
        {singles.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-ink2 px-3 py-2">
            <p className="text-xs text-fog">Single {s.label}</p>
            <p className="text-lg font-bold">{s.cost === null ? "Doesn't fit" : rupees(Math.round(s.cost * 100) / 100)}</p>
            {s.cost !== null && <p className="text-xs text-fog">{s.fit} on a sheet</p>}
          </div>
        ))}
      </section>

      <section>
        <div className="flex flex-wrap gap-2">
          <div className="flex h-9 min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-ink2 px-2.5">
            <Search className="size-4 shrink-0 text-fog" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${walls.length} walls`}
              className="w-full bg-transparent text-sm text-snow outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort walls"
            className="h-9 rounded-lg border border-line bg-ink2 px-2 text-sm text-snow outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 hidden grid-cols-[1fr_4rem_4.5rem_4.5rem_6.5rem] gap-3 px-3 text-xs font-semibold text-fog sm:grid">
          <span>Wall</span>
          <span className="text-right">Sheets</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Price</span>
          <span className="text-right">Margin</span>
        </div>
        <ul className="mt-2 space-y-1.5 sm:mt-1">
          {shown.map(({ wall, sheets, cost, margin }) => (
            <li key={wall.id} className="rounded-xl border border-line bg-ink2 px-2.5 py-2 sm:px-3">
              <div className="flex items-center gap-2.5 sm:grid sm:grid-cols-[1fr_4rem_4.5rem_4.5rem_6.5rem] sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageSrc(wall.image)} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg bg-ink object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {wall.name}
                      {wall.hidden && <span className="ml-1.5 text-xs font-normal text-fog">Hidden</span>}
                    </p>
                    <p className="truncate text-xs text-fog">{sizesLabel(wall.inches)}</p>
                  </div>
                </div>
                {sheets === null ? (
                  <p className="text-right text-xs text-brand sm:col-span-4">Doesn&apos;t fit this paper</p>
                ) : (
                  <>
                    <p className="hidden text-right text-sm sm:block">{sheets}</p>
                    <p className="hidden text-right text-sm sm:block">{whole(cost ?? 0)}</p>
                    <p className="hidden text-right text-sm sm:block">₹{wall.price}</p>
                    <p className={`hidden text-right text-sm font-semibold sm:block ${(margin ?? 0) < 0 ? "text-brand" : ""}`}>
                      {whole(margin ?? 0)}
                      {wall.price > 0 && <span className="ml-1 text-xs font-normal text-fog">{Math.round(((margin ?? 0) / wall.price) * 100)}%</span>}
                    </p>
                  </>
                )}
              </div>
              {sheets !== null && (
                <div className="mt-1.5 grid grid-cols-4 gap-1 text-xs sm:hidden">
                  <p><span className="block text-fog">Sheets</span>{sheets}</p>
                  <p><span className="block text-fog">Cost</span>{whole(cost ?? 0)}</p>
                  <p><span className="block text-fog">Price</span>₹{wall.price}</p>
                  <p className={`font-semibold ${(margin ?? 0) < 0 ? "text-brand" : ""}`}>
                    <span className="block font-normal text-fog">Margin</span>
                    {whole(margin ?? 0)}
                    {wall.price > 0 && <span className="ml-1 font-normal text-fog">{Math.round(((margin ?? 0) / wall.price) * 100)}%</span>}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
