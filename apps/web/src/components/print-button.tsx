"use client";

import { Download } from "lucide-react";

/** Opens the browser's print dialog — "Save as PDF" downloads the invoice. */
export default function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="peel-btn peel-btn--brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
    >
      <Download className="size-4" /> {label}
    </button>
  );
}
