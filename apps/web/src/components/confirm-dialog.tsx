"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import LabelModal from "./label-modal";

/**
 * The shop's own confirm / alert, instead of the browser's grey box — shown as
 * a peel-on / peel-off sticker label (LabelModal). Use through useConfirm():
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete this address?", tone: "danger" })) …
 */
export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** null = alert: one button only. */
  cancelLabel?: string | null;
  tone?: "default" | "danger" | "info";
};

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // Kept after closing so the label still has its text while it peels off.
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve });
        setOpen(true);
      }),
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      if (!open || !request) return;
      request.resolve(ok);
      setOpen(false);
    },
    [open, request]
  );

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const tone = request?.tone ?? "default";
  const Icon = tone === "danger" ? AlertTriangle : tone === "info" ? Info : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <LabelModal
          open={open}
          onClose={() => close(request.cancelLabel === null)}
          role="alertdialog"
          labelledBy="confirm-title"
          describedBy={request.message ? "confirm-message" : undefined}
          className="max-w-[22rem] p-5"
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-2xl border-[3px] border-white text-white shadow-md ${
                tone === "danger"
                  ? "bg-brand shadow-brand/25"
                  : tone === "info"
                    ? "bg-sky-500 shadow-sky-500/25"
                    : "pie-gradient shadow-brand/25"
              }`}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id="confirm-title" className="font-display text-lg leading-snug font-bold">
                {request.title}
              </h2>
              {request.message && (
                <p id="confirm-message" className="mt-1 text-sm leading-relaxed text-fog">
                  {request.message}
                </p>
              )}
            </div>
          </div>
          <div className={`mt-5 grid gap-2 ${request.cancelLabel === null ? "" : "grid-cols-2"}`}>
            {request.cancelLabel !== null && (
              <button
                type="button"
                onClick={() => close(false)}
                className="peel-btn peel-btn--light h-11 rounded-xl text-sm font-bold"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={() => close(true)}
              className={`h-11 rounded-xl text-sm font-bold ${tone === "info" ? "peel-btn" : "peel-btn peel-btn--brand"}`}
            >
              {request.confirmLabel ?? "OK"}
            </button>
          </div>
        </LabelModal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
