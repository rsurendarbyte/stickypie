// Browser-only: conversation links this browser has opened or started, so
// guests find their previous threads on the contact page without signing in.
const KEY = "sp_threads";
const MAX = 20;

type Saved = { id: string; k: string };

export function savedThreads(): Saved[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x?.id === "string" && typeof x?.k === "string") : [];
  } catch {
    return [];
  }
}

/** path: /contact/t/<id>?k=<key> */
export function rememberThread(path: string) {
  const m = path.match(/\/contact\/t\/([0-9a-f-]{36})\?k=([0-9a-f]+)/i);
  if (!m) return;
  try {
    const list = [{ id: m[1], k: m[2] }, ...savedThreads().filter((x) => x.id !== m[1])].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage blocked: the email link still works */
  }
}

const SEEN_KEY = "sp_threads_seen";
const ME_KEY = "sp_contact_me";

/** When the shopper last looked at each conversation (id → ISO time). */
export function seenTimes(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function markSeen(id: string, at: string) {
  try {
    const seen = seenTimes();
    if ((seen[id] ?? "") >= at) return;
    seen[id] = at;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {}
}

export type ContactMe = { name: string; phone: string; email: string };

/** Name / mobile / email from the last message sent here (pre-fills the help bubble form). */
export function loadMe(): ContactMe | null {
  try {
    const v = JSON.parse(localStorage.getItem(ME_KEY) ?? "null");
    return v && typeof v.email === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveMe(me: ContactMe) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {}
}
