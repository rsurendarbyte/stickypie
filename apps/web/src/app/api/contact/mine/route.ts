// "Your conversations": threads started with the signed-in shopper's
// (confirmed) email (GET, Bearer token), and/or the ones this browser kept
// links to (POST { items: [{ id, k }] }, no sign-in needed: the key is the pass).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriver } from "@/lib/data";
import { shopperFromRequest } from "@/lib/shopper";
import { summarizeThread, threadForKey } from "@/lib/contact-thread";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: Request) {
  const shopper = await shopperFromRequest(req);
  if (!shopper) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!shopper.confirmed) return NextResponse.json({ threads: [] }, noStore);
  const list = await getDriver().listContactMessagesByEmail(shopper.email).catch(() => []);
  return NextResponse.json({ threads: list.map(summarizeThread) }, noStore);
}

const schema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), k: z.string().min(10).max(100) })).max(20),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ threads: [] }, noStore);
  const found = await Promise.all(parsed.data.items.map(({ id, k }) => threadForKey(id, k)));
  const threads = found.filter((m) => m !== null).map(summarizeThread);
  return NextResponse.json({ threads }, noStore);
}
