// Server-only: 6-digit email verification codes for new shopper accounts.
// Stored hashed (HMAC) in public.email_verifications, which only the service
// role can reach. Limits: 10-minute expiry, 5 wrong tries per code, one email
// per minute and at most 5 per hour per address.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { supabaseUrl } from "./mode";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

type Row = {
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  sends: number;
  window_start: string;
  last_sent_at: string;
};

export class CodeError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

function key(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function hash(email: string, code: string): string {
  return createHmac("sha256", key()).update(`${email}:${code}`).digest("hex");
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${supabaseUrl()}/rest/v1/email_verifications${path}`, {
    ...init,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function load(email: string): Promise<Row | null> {
  const res = await rest(`?email=eq.${encodeURIComponent(email)}&select=*`);
  if (!res.ok) throw new Error(`email_verifications read failed (${res.status})`);
  const rows = (await res.json()) as Row[];
  return rows[0] ?? null;
}

/** Makes a new code for this email (respecting the send limits) and returns it. */
export async function issueCode(email: string): Promise<string> {
  const now = Date.now();
  const row = await load(email);
  if (row) {
    const wait = new Date(row.last_sent_at).getTime() + RESEND_AFTER_MS - now;
    if (wait > 0) throw new CodeError(`Please wait ${Math.ceil(wait / 1000)}s before asking for another code.`, 429);
    const windowOpen = now - new Date(row.window_start).getTime() < 3_600_000;
    if (windowOpen && row.sends >= MAX_SENDS_PER_HOUR) {
      throw new CodeError("Too many codes requested for this email. Please try again in an hour.", 429);
    }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const windowOpen = row ? now - new Date(row.window_start).getTime() < 3_600_000 : false;
  const res = await rest("?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      email,
      code_hash: hash(email, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      sends: windowOpen ? row!.sends + 1 : 1,
      window_start: windowOpen ? row!.window_start : new Date(now).toISOString(),
      last_sent_at: new Date(now).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`email_verifications write failed (${res.status})`);
  return code;
}

/** Throws a CodeError unless `code` is the current, unexpired code for this email. */
export async function checkCode(email: string, code: string): Promise<void> {
  const row = await load(email);
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new CodeError("This code has expired — tap “Send a new code”.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new CodeError("Too many wrong tries — tap “Send a new code”.");
  }
  const a = Buffer.from(hash(email, code));
  const b = Buffer.from(row.code_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await rest(`?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ attempts: row.attempts + 1 }),
    });
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new CodeError(
      left > 0 ? `That code isn't right — ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries — tap “Send a new code”."
    );
  }
}

/** Code used up (account created). */
export async function clearCode(email: string): Promise<void> {
  await rest(`?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
}
