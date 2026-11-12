import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseConfigured, supabaseUrl } from "@/lib/mode";

const schema = z.object({ token: z.string().uuid() });

/** Cloudflare's guess at where this visitor is; nothing outside the shop is asked. */
async function connectionPlace(): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { cf } = await getCloudflareContext({ async: true });
    const parts = [cf?.city, cf?.region, cf?.country === "IN" ? null : cf?.country];
    return parts.filter(Boolean).join(", ").slice(0, 120) || null;
  } catch {
    return null; // not running on Cloudflare (local dev)
  }
}

/**
 * Notes the city and state of a cart, once a visit, for the admin's Carts page.
 * Comes through here because only the Worker knows them: carts save straight to
 * Supabase, which sees just the country. The location is read from the request,
 * never taken from the browser. The IP address (Cloudflare's cf-connecting-ip)
 * is kept too, for the admin only.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const place = await connectionPlace();
  const rawIp = req.headers.get("cf-connecting-ip")?.trim();
  const ip = rawIp && /^[0-9a-f.:]{3,45}$/i.test(rawIp) ? rawIp : null;
  if ((place || ip) && supabaseConfigured()) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    await fetch(`${supabaseUrl()}/rest/v1/carts?token=eq.${parsed.data.token}&status=eq.pending`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...(place ? { place } : {}), ...(ip ? { ip } : {}) }),
    });
  }
  return new NextResponse(null, { status: 204 });
}
