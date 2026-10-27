"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudUpload, ImageUp, Loader2, RefreshCw } from "lucide-react";
import {
  CUSTOM_STICKER_MAX_BYTES,
  CUSTOM_STICKER_TYPES,
  customArtKey,
  formatInches,
} from "@stickypie/shared";
import { idbDelete, idbGet } from "@/lib/idb";
import { shrinkImage } from "@/lib/shrink-image";
import { useShopper } from "@/lib/shopper-auth";

type Item = {
  id: string;
  name: string;
  customRef: string | null;
  hasFile: boolean;
  imageUrl: string;
  sizeInches: number | null;
  quantity: number;
  /** Avatar sticker book: the upload is the shopper's photo, not print artwork. */
  photo?: boolean;
};

type ItemState =
  | { kind: "checking" }
  | { kind: "queued"; file: Blob }
  | { kind: "uploading"; progress: number }
  | { kind: "done" }
  | { kind: "failed"; message: string }
  | { kind: "missing" };

/** Uploads one file with real progress (fetch can't report upload progress). */
function upload(
  orderId: string,
  itemId: string,
  file: Blob,
  token: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("itemId", itemId);
    form.append("file", file instanceof File ? file : new File([file], "design", { type: file.type }));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/orders/${orderId}/custom-file`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network problem — check your connection and try again."));
    xhr.send(form);
  });
}

/**
 * Success page for a paid custom order: sends the designs the shopper picked
 * before checkout (kept on this device) with a progress bar, asks them to keep
 * the page open meanwhile, and lets them pick the file again if it failed.
 */
export default function CustomOrderUpload({
  orderId,
  orderUserId,
  firstName,
  items,
}: {
  orderId: string;
  orderUserId: string | null;
  firstName: string;
  items: Item[];
}) {
  const shopper = useShopper();
  const router = useRouter();
  const token = shopper.session?.access_token ?? null;
  const owner = Boolean(shopper.session && shopper.session.user.id === orderUserId);
  const [states, setStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.hasFile ? { kind: "done" } : { kind: "checking" }]))
  );
  const running = useRef(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const set = (id: string, state: ItemState) => setStates((prev) => ({ ...prev, [id]: state }));

  async function send(item: Item, file: Blob) {
    if (!token) return;
    set(item.id, { kind: "uploading", progress: 0 });
    try {
      await upload(orderId, item.id, file, token, (progress) => set(item.id, { kind: "uploading", progress }));
      if (item.customRef) await idbDelete(customArtKey(item.customRef));
      set(item.id, { kind: "done" });
    } catch (err) {
      set(item.id, { kind: "failed", message: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  // Find the designs saved on this device, then send them one by one.
  useEffect(() => {
    if (!owner || !token || running.current) return;
    running.current = true;
    void (async () => {
      const queue: { item: Item; file: Blob }[] = [];
      for (const item of items) {
        if (item.hasFile) continue;
        const saved = item.customRef ? await idbGet<Blob>(customArtKey(item.customRef)) : null;
        if (saved) {
          queue.push({ item, file: saved });
          set(item.id, { kind: "queued", file: saved });
        } else {
          set(item.id, { kind: "missing" });
        }
      }
      for (const { item, file } of queue) await send(item, file);
      if (queue.length) router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, token]);

  // Signed out / someone else: nothing is being sent from this device.
  const view = (s: ItemState): ItemState => (!owner && s.kind === "checking" ? { kind: "missing" } : s);
  const values = Object.values(states).map(view);
  const busy = values.some((s) => s.kind === "uploading" || s.kind === "queued" || s.kind === "checking");
  const needsAction = values.some((s) => s.kind === "failed" || s.kind === "missing");
  const allDone = values.every((s) => s.kind === "done");
  // Avatar sticker books send a photo; everything else sends a design.
  const noun = items.every((i) => i.photo) ? "photo" : "design";

  // Leaving mid-upload would lose the design — warn first.
  useEffect(() => {
    if (!busy || !owner) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, owner]);

  function pick(item: Item, file: File | undefined) {
    if (!file) return;
    if (item.photo) {
      // Phone photos are big: send a 2000px copy, like the avatar maker does.
      shrinkImage(file, 2000, 2_500_000)
        .then((small) => send(item, small))
        .then(() => router.refresh())
        .catch((err) => set(item.id, { kind: "failed", message: err instanceof Error ? err.message : "Couldn't open that photo." }));
      return;
    }
    if (!(CUSTOM_STICKER_TYPES as readonly string[]).includes(file.type)) {
      set(item.id, { kind: "failed", message: "Please choose a PNG, JPG or WebP image." });
      return;
    }
    if (file.size > CUSTOM_STICKER_MAX_BYTES) {
      set(item.id, { kind: "failed", message: "That file is over 5 MB." });
      return;
    }
    void send(item, file).then(() => router.refresh());
  }

  const totalProgress = Math.round(
    values.reduce((sum, s) => sum + (s.kind === "done" ? 100 : s.kind === "uploading" ? s.progress : 0), 0) /
      Math.max(values.length, 1)
  );

  return (
    <div className="mx-auto max-w-xl">
      {/* Header */}
      <div className="text-center">
        {allDone ? (
          <CheckCircle2 className="mx-auto size-16 animate-pop text-mint" />
        ) : needsAction && !busy ? (
          <ImageUp className="mx-auto size-16 text-brand" />
        ) : (
          <span className="relative mx-auto grid size-20 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-snow/10" />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className="stroke-brand transition-all duration-300"
                strokeDasharray={`${(totalProgress / 100) * 100.5} 100.5`}
              />
            </svg>
            <span className="font-display text-lg font-bold">{totalProgress}%</span>
          </span>
        )}
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          {allDone ? "Order confirmed! 🎉" : needsAction && !busy ? "One more step" : `Sending your ${noun}…`}
        </h1>
        <p className="mt-2 text-sm text-fog">
          {allDone
            ? `Thanks ${firstName} — ${noun === "photo" ? "we've got your photo. We'll draw your stickers and show them on this page, then print and ship." : "we've got your design and will check it before printing. You can replace it until we start working on your order."}`
            : needsAction && !busy
              ? `Payment received, ${firstName}. ${noun === "photo" ? "Upload your photo so we can draw your stickers." : "Upload your design so we can print your stickers."}`
              : `Payment received, ${firstName}. We're uploading your ${noun} now.`}
        </p>
      </div>

      {busy && owner && (
        <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm font-semibold text-snow">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
          Please keep this page open and don&apos;t close your browser until the upload finishes.
        </p>
      )}
      {!owner && !allDone && (
        <p className="mt-5 rounded-2xl border border-line bg-ink2 p-4 text-center text-sm text-fog">
          Sign in with the account you ordered from to send your {noun}.
        </p>
      )}

      {/* One row per design */}
      <ul className="mt-5 space-y-3">
        {items.map((item) => {
          const state = view(states[item.id]);
          return (
            <li key={item.id} className="rounded-2xl border border-line bg-ink2 p-4">
              <div className="flex items-center gap-3">
                <span className="grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel">
                  {item.hasFile || state.kind === "done" ? (
                    <img src={item.imageUrl || "/icons/custom-sticker.svg"} alt="" className="size-full object-contain" />
                  ) : (
                    <CloudUpload className="size-6 text-fog" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {item.name}{item.sizeInches ? ` · ${formatInches(item.sizeInches)}″` : ""} × {item.quantity}
                  </span>
                  <span className="block text-xs text-fog">
                    {state.kind === "done" && (item.photo ? "Photo received ✓" : "Design received ✓")}
                    {state.kind === "checking" && (item.photo ? "Getting your photo ready…" : "Getting your design ready…")}
                    {state.kind === "queued" && "Waiting to upload…"}
                    {state.kind === "uploading" && `Uploading… ${state.progress}%`}
                    {state.kind === "missing" && `We couldn't find your ${item.photo ? "photo" : "design"} on this device.`}
                    {state.kind === "failed" && <span className="text-brand">{state.message}</span>}
                  </span>
                </span>
                {state.kind === "uploading" || state.kind === "queued" || state.kind === "checking" ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-fog" />
                ) : owner && (state.kind === "failed" || state.kind === "missing" || state.kind === "done") ? (
                  <>
                    <input
                      ref={(el) => {
                        inputs.current[item.id] = el;
                      }}
                      type="file"
                      accept={item.photo ? "image/*" : CUSTOM_STICKER_TYPES.join(",")}
                      className="sr-only"
                      onChange={(e) => {
                        pick(item, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => inputs.current[item.id]?.click()}
                      className={
                        state.kind === "done"
                          ? "inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline"
                          : "peel-btn peel-btn--brand inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
                      }
                    >
                      {state.kind === "done" ? (
                        <>
                          <RefreshCw className="size-3.5" /> Replace
                        </>
                      ) : (
                        <>
                          <ImageUp className="size-4" /> {state.kind === "failed" ? "Try again" : item.photo ? "Upload photo" : "Upload design"}
                        </>
                      )}
                    </button>
                  </>
                ) : null}
              </div>
              {state.kind === "uploading" && (
                <span className="mt-3 block h-2 overflow-hidden rounded-full bg-snow/10">
                  <span
                    className="pie-gradient block h-full rounded-full transition-[width] duration-200"
                    style={{ width: `${state.progress}%` }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {needsAction && !busy && owner && (
        <p className="mt-3 text-center text-xs text-fog">
          {noun === "photo" ? "A clear photo of your face, in good light" : "PNG, JPG or WebP · up to 5 MB · the highest quality you have"}
        </p>
      )}
    </div>
  );
}
