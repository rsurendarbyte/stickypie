"use client";

import { ChevronDown, Droplets, Palette, Ruler, Truck } from "lucide-react";
import { formatInches } from "@stickypie/shared";

function Panel({
  icon: Icon,
  title,
  open = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-3.5 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden">
        <Icon className="size-4 shrink-0 text-brand" />
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 shrink-0 text-fog transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-2 pb-4 pl-[26px] text-[13px] leading-relaxed text-fog">{children}</div>
    </details>
  );
}

/**
 * Collapsible product details. Dimensions follow the size picked above
 * (size = longest side; the other side follows the design's aspect ratio).
 */
export default function ProductDetails({ size }: { size: number | null }) {
  const inch = size === null ? null : formatInches(size);
  return (
    <div className="mt-6 max-w-lg rounded-2xl border border-line bg-ink px-4">
      {inch && (
        <Panel icon={Ruler} title={`Dimensions · ${inch}″`} open>
          <p>
            Fits within a{" "}
            <span className="font-semibold text-snow">
              {inch} × {inch} inch
            </span>{" "}
            area.
          </p>
          <p>Height &amp; width depend on the aspect ratio of the design.</p>
          <p className="flex items-start gap-1.5 pt-1 text-xs">
            <Palette className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold text-snow">Please note:</span> colours may slightly vary
              depending on your screen brightness.
            </span>
          </p>
        </Panel>
      )}
      {!inch && (
        <Panel icon={Palette} title="Colour note" open>
          <p>Colours may slightly vary depending on your screen brightness.</p>
        </Panel>
      )}
      <Panel icon={Droplets} title="Material & care">
        <p>Premium die-cut vinyl — waterproof, scratch-proof and UV / fade resistant.</p>
        <p>Stick on a clean, dry, smooth surface and press firmly from the centre outwards.</p>
      </Panel>
      <Panel icon={Truck} title="Shipping">
        <p>Packed and dispatched in 2–4 business days, in bend-proof packaging.</p>
        <p>Shipping is charged by delivery distance and shown at checkout once you enter your PIN code.</p>
      </Panel>
    </div>
  );
}
