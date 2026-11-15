// Server-only helpers for contact conversations (/contact/t/<id>?k=<key>).
import { CONTACT_TOPICS, contactThreadPath, type ContactMessage } from "@stickypie/shared";
import { getDriver } from "./data";
import { siteUrl, supabaseConfigured, supabaseUrl } from "./mode";

/** Same-length compare that doesn't stop at the first wrong character. */
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The conversation, only for whoever holds its private key. */
export async function threadForKey(id: string, key: string): Promise<ContactMessage | null> {
  const m = await getDriver().getContactMessage(id).catch(() => null);
  return m && sameKey(m.accessKey, key) ? m : null;
}

export function threadUrl(m: { id: string; accessKey: string }): string {
  return `${siteUrl()}${contactThreadPath(m)}`;
}

/** Short list row for "Your conversations" (contact page, account page). */
export type ThreadSummary = {
  id: string;
  path: string;
  topic: string;
  status: ContactMessage["status"];
  preview: string;
  lastFrom: "admin" | "customer";
  updatedAt: string;
};

export function summarizeThread(m: ContactMessage): ThreadSummary {
  const last = m.replies.at(-1);
  return {
    id: m.id,
    path: contactThreadPath(m),
    topic: CONTACT_TOPICS[m.topic] ?? m.topic,
    status: m.status,
    preview: (last?.body ?? m.message).slice(0, 140),
    lastFrom: last?.author ?? "customer",
    updatedAt: last?.createdAt ?? m.createdAt,
  };
}

/** Realtime channel the shopper's browser listens on (named by the private key). */
export function threadChannel(accessKey: string): string {
  return `contact-${accessKey}`;
}

/**
 * Tells the shopper's open pages (help bubble, conversation page) that the
 * conversation changed: a bare signal, they fetch the rest with their key.
 * Never fatal.
 */
export async function signalThread(m: { id: string; accessKey: string }): Promise<void> {
  if (!supabaseConfigured()) return;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  try {
    const res = await fetch(`${supabaseUrl()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ topic: threadChannel(m.accessKey), event: "changed", payload: { id: m.id } }],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("[contact] live signal refused:", res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error("[contact] live signal failed:", err);
  }
}

/** What the shopper's own pages see of a conversation (no email / phone). */
export function publicThread(m: ContactMessage) {
  return {
    id: m.id,
    topic: CONTACT_TOPICS[m.topic] ?? m.topic,
    orderCode: m.orderCode,
    status: m.status,
    message: m.message,
    createdAt: m.createdAt,
    replies: m.replies.map(({ id, author, body, createdAt }) => ({ id, author, body, createdAt })),
  };
}
