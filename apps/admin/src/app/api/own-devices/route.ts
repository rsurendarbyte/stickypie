import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/data";
import { createServerSupabase } from "@/lib/supabase";

// "This is me" / "Not me" on Journeys and Carts: remember (or forget) an IP and a
// browser as the shop owner's own.
const body = z
  .object({
    ip: z.string().regex(/^[0-9a-f.:]{3,45}$/i).optional(),
    visitorId: z.string().uuid().optional(),
  })
  .refine((b) => b.ip || b.visitorId);

async function parse(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const b = await parse(req);
  if (!b) return NextResponse.json({ error: "Nothing to mark" }, { status: 400 });
  const db = await createServerSupabase();
  const rows: { ip?: string; visitor_id?: string; label: string }[] = [
    ...(b.ip ? [{ ip: b.ip, label: "me" }] : []),
    ...(b.visitorId ? [{ visitor_id: b.visitorId, label: "me" }] : []),
  ];
  for (const row of rows) {
    const { error } = await db.from("own_devices").insert(row);
    // already marked is fine
    if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.res;
  const b = await parse(req);
  if (!b) return NextResponse.json({ error: "Nothing to unmark" }, { status: 400 });
  const db = await createServerSupabase();
  if (b.ip) await db.from("own_devices").delete().eq("ip", b.ip);
  if (b.visitorId) await db.from("own_devices").delete().eq("visitor_id", b.visitorId);
  return NextResponse.json({ ok: true });
}
