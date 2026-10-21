// Edge-safe auth helpers (imported by middleware — no Node-only APIs here).

export const ADMIN_COOKIE = "sp_admin";

/** Supabase project URL (accepts the dashboard's NEXT_PUBLIC_ naming too). */
export function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Anon / publishable key (either env name works). */
export function supabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Admin runs against Supabase when both vars are set; otherwise local demo mode. */
export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function demoPassword(): string {
  return process.env.ADMIN_DEV_PASSWORD ?? "stickypie";
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stateless demo-mode session token (survives server restarts). */
export function demoToken(): Promise<string> {
  return sha256Hex(`stickypie-demo-admin:${demoPassword()}`);
}

/** Storefront origin — used to preview relative image paths like /stickers/x.png. */
export function webUrl(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
