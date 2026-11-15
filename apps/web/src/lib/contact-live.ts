"use client";

// Shopper's contact conversations, live: one shared list for the header bell,
// the help bubble, the contact page and the account page. Threads come from the
// signed-in account's email and the links this browser kept; each kept thread
// listens on its own Supabase Realtime channel (named by its private key) for a
// bare "changed" signal from the server, then re-fetches.
//
// Guests with no conversations never load anything (no supabase-js, no fetch).
import { useEffect, useState } from "react";
import { currentSession, loadAuthClient } from "./shopper-auth";
import { markSeen, rememberThread, savedThreads, seenTimes } from "./contact-local";

export type ThreadRow = {
  id: string;
  path: string;
  topic: string;
  status: "new" | "replied" | "resolved";
  preview: string;
  lastFrom: "admin" | "customer";
  updatedAt: string;
};

type State = { threads: ThreadRow[]; seen: Record<string, string>; ready: boolean };
let state: State = { threads: [], seen: {}, ready: false };
const listeners = new Set<(s: State) => void>();
const changeListeners = new Set<(id: string) => void>();
let started = false;
let loading: Promise<void> | null = null;
const channels = new Map<string, unknown>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

function keyOf(path: string): string | null {
  return path.match(/[?&]k=([0-9a-f]+)/i)?.[1] ?? null;
}

async function fetchThreads(): Promise<ThreadRow[]> {
  const token = (await currentSession().catch(() => null))?.access_token;
  const local = savedThreads();
  const get = (init?: RequestInit) =>
    fetch("/api/contact/mine", { cache: "no-store", ...init })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [mine, kept] = await Promise.all([
    token ? get({ headers: { Authorization: `Bearer ${token}` } }) : null,
    local.length
      ? get({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: local }) })
      : null,
  ]);
  const byId = new Map<string, ThreadRow>();
  for (const t of [...(mine?.threads ?? []), ...(kept?.threads ?? [])] as ThreadRow[]) byId.set(t.id, t);
  for (const t of mine?.threads ?? []) rememberThread((t as ThreadRow).path);
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Listens for live signals on every known thread (adds new ones as they come). */
async function connectLive(threads: ThreadRow[]) {
  const wanted = threads.map((t) => ({ id: t.id, key: keyOf(t.path) })).filter((t) => t.key && !channels.has(t.key));
  if (!wanted.length) return;
  const client = await loadAuthClient().catch(() => null);
  if (!client) return;
  for (const { id, key } of wanted) {
    if (channels.has(key!)) continue;
    const ch = client
      .channel(`contact-${key}`)
      .on("broadcast", { event: "changed" }, () => {
        void refreshThreads().then(() => changeListeners.forEach((l) => l(id)));
      })
      .subscribe();
    channels.set(key!, ch);
  }
}

/** Re-fetches the list (after sending, or on a live signal). */
export function refreshThreads(): Promise<void> {
  loading ??= fetchThreads()
    .then((threads) => {
      emit({ threads, seen: seenTimes(), ready: true });
      void connectLive(threads);
      if (threads.length && !watchingVisibility) {
        watchingVisibility = true;
        // came back to the tab: catch anything missed while the phone slept
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void refreshThreads();
        });
      }
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Starts once per page load; skipped entirely for guests with no conversations. */
export async function startContactLive() {
  if (started) return;
  started = true;
  const hasLocal = savedThreads().length > 0;
  const signedIn = !hasLocal && Boolean(await currentSession().catch(() => null));
  if (!hasLocal && !signedIn) {
    emit({ ready: true });
    return;
  }
  await refreshThreads();
}

let watchingVisibility = false;

/** A thread changed live (open chat / conversation page re-fetches it). */
export function onThreadChanged(cb: (id: string) => void): () => void {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

export function markThreadSeen(id: string, at: string) {
  markSeen(id, at);
  emit({ seen: seenTimes() });
}

export function isUnread(t: ThreadRow, seen: Record<string, string>): boolean {
  return t.lastFrom === "admin" && t.updatedAt > (seen[t.id] ?? "");
}

export function useContactThreads() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    void startContactLive();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return { threads: s.threads, ready: s.ready, unread: s.threads.filter((t) => isUnread(t, s.seen)).length, seen: s.seen };
}

/** Header bell / anywhere: open the help bubble (optionally on one conversation). */
export const HELP_OPEN_EVENT = "sp-help-open";
export function openHelp(threadId?: string) {
  window.dispatchEvent(new CustomEvent(HELP_OPEN_EVENT, { detail: threadId ?? null }));
}
