"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatINR, type StoreSettings } from "@stickypie/shared";
import AvatarSettings from "./avatar-settings";
import { useToast } from "./toast";

/** Avatar book page: pages, book price and the styles, saved on their own. */
export default function AvatarBookForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pages, setPages] = useState(String(initial.avatarBook.pages));
  const [price, setPrice] = useState(String(initial.avatarBook.price));
  const [extra, setExtra] = useState(initial.avatarBook.extra ? String(initial.avatarBook.extra) : "");
  const [styles, setStyles] = useState(initial.avatarStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
    setSaving(true);
    try {
      const res = await fetch("/api/settings/avatar-book", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarBook: { pages: num(pages), price: num(price), extra: extra.trim() === "" ? 0 : num(extra) },
          avatarStyles: styles,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      toast("Avatar packs saved");
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
    <form onSubmit={save} className="rounded-2xl border border-line bg-ink2 p-5">
      <AvatarSettings
        pages={pages}
        onPages={setPages}
        price={price}
        onPrice={setPrice}
        extra={extra}
        onExtra={setExtra}
        styles={styles}
        onStyles={setStyles}
      />
      {error && <p className="mt-3 text-xs text-brand">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="pie-gradient flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />} Save
        </button>
        <span className="text-xs text-fog">
          Currently:{" "}
          {initial.avatarBook.price > 0
            ? `${initial.avatarBook.pages}+ packs · ${formatINR(initial.avatarBook.price)} a pack${
                initial.avatarBook.extra > 0 && initial.avatarBook.extra !== initial.avatarBook.price
                  ? `, then ${formatINR(initial.avatarBook.extra)} each extra`
                  : ""
              }`
            : "not offered"}{" "}
          · {initial.avatarStyles.length} style{initial.avatarStyles.length === 1 ? "" : "s"}
        </span>
      </div>
    </form>
  );
}
