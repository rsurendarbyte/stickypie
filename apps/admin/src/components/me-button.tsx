"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserCheck, UserX } from "lucide-react";

/** "This is me" / "Not me": marks this IP (and browser) as the shop owner's own. */
export default function MeButton({ ip, visitorId, isMe }: { ip?: string | null; visitorId?: string | null; isMe: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  if (!ip && !visitorId) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const res = await fetch("/api/own-devices", {
      method: isMe ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(ip ? { ip } : {}), ...(visitorId ? { visitorId } : {}) }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Couldn't save — is the 20261112000001_client_ip migration applied?");
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
        isMe ? "border-line text-fog hover:text-snow" : "border-sky-400/40 bg-sky-400/10 text-sky-300 hover:border-sky-400"
      }`}
    >
      {isMe ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
      {busy ? "Saving…" : isMe ? "Not me" : "This is me"}
    </button>
  );
}
