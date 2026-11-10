import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@stickypie/shared";
import { supabaseConfigured, supabaseUrl } from "@/lib/mode";

// Shopper journeys for the admin's Journeys page (journey_ingest in Supabase).
// The browser batches its page views and key steps and sends them here a few
// times a visit (sendBeacon on leaving). Only paths are kept: anything after
// "?" or "#" is cut here too, so guest keys, ad ids and sign-in tokens never
// reach the database. City and device come from the request, never the IP.
// The name, email and phone a guest types at checkout come too (for following up
// on unpaid carts), only once they look complete.

const MAX_BODY = 32_000;
const uuid = z.string().uuid();
const path = z.string().max(400);
const data = z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional();

const schema = z.object({
  sid: uuid,
  vid: uuid,
  visit: z.number().int().min(1).max(100_000),
  entry: path.optional(),
  source: z.string().max(40).optional(),
  campaign: z.string().max(80).optional(),
  medium: z.string().max(40).optional(),
  content: z.string().max(80).optional(),
  ad: z.boolean().optional(),
  referrer: z.string().max(80).optional(),
  screen: z.string().max(20).optional(),
  lang: z.string().max(20).optional(),
  // what a guest typed at checkout (checked again below)
  contact: z
    .object({ name: z.string().max(80).optional(), email: z.string().max(120).optional(), phone: z.string().max(20).optional() })
    .optional(),
  cart: uuid.optional(),
  order: uuid.optional(),
  pages: z.array(z.object({ i: z.number().int().min(0).max(1000), p: path, t: z.number(), ms: z.number().min(0) })).max(60),
  events: z.array(z.object({ e: z.string().max(32), t: z.number(), p: path, d: data })).max(60),
});

const BOT = /bot|crawl|spider|lighthouse|facebookexternalhit|headless/i;

/** Only the path, never the query or hash; long ids are fine (orders need ?k= to open). */
const clean = (p: string) => p.split(/[?#]/)[0].slice(0, 200) || "/";

/** "iPhone · Instagram app", "Android · Chrome", "Desktop · Safari". */
function deviceOf(ua: string): string {
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone|iPod/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Windows|Linux|CrOS/.test(ua)
          ? "Desktop"
          : "Other";
  const app = /Instagram/.test(ua)
    ? "Instagram app"
    : /FBAN|FBAV|FB_IAB/.test(ua)
      ? "Facebook app"
      : /SamsungBrowser/.test(ua)
        ? "Samsung"
        : /EdgA?\//.test(ua)
          ? "Edge"
          : /CriOS|Chrome\//.test(ua)
            ? "Chrome"
            : /Firefox|FxiOS/.test(ua)
              ? "Firefox"
              : /Safari/.test(ua)
                ? "Safari"
                : "Browser";
  return `${os} · ${app}`;
}

async function connectionPlace(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { cf } = await getCloudflareContext({ async: true });
    const parts = [cf?.city, cf?.region, cf?.country === "IN" ? null : cf?.country];
    return parts.filter(Boolean).join(", ").slice(0, 120) || null;
  } catch {
    return null; // not on Cloudflare (local dev)
  }
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!supabaseConfigured() || BOT.test(ua)) return new NextResponse(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const b = parsed.data;

  // only well-formed details are kept
  const c = b.contact;
  const name = c?.name?.trim().replace(/\s+/g, " ");
  const email = c?.email?.trim().toLowerCase();
  const phone = c?.phone ? normalizePhone(c.phone) : undefined;
  const contact = c
    ? {
        ...(name && name.length >= 2 ? { name } : {}),
        ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? { email } : {}),
        ...(phone && /^[6-9]\d{9}$/.test(phone) ? { phone } : {}),
      }
    : undefined;
  if (!b.pages.length && !b.events.length && !(contact && Object.keys(contact).length)) return new NextResponse(null, { status: 204 });

  const payload = {
    ...b,
    contact: contact && Object.keys(contact).length ? contact : undefined,
    referrer: b.referrer?.replace(/[^a-z0-9.-]/gi, "").slice(0, 80) || undefined,
    entry: b.entry ? clean(b.entry) : undefined,
    pages: b.pages.map((x) => ({ ...x, p: clean(x.p) })),
    events: b.events.map((x) => ({ ...x, p: clean(x.p) })),
    device: deviceOf(ua),
    // city only needs reading on a visit's first batch
    place: b.entry ? await connectionPlace() : null,
  };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  await fetch(`${supabaseUrl()}/rest/v1/rpc/journey_ingest`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p: payload }),
  }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
