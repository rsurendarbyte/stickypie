"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, demoPassword, demoToken, supabaseConfigured } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!supabaseConfigured()) {
    const password = String(formData.get("password") ?? "");
    if (password !== demoPassword()) {
      return { error: "Wrong password. Default is in apps/admin/.env.example (ADMIN_DEV_PASSWORD)." };
    }
    const store = await cookies();
    store.set(ADMIN_COOKIE, await demoToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message ?? "Sign-in failed. Check your credentials." };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    return {
      error:
        "This account exists but has no admin access. Run supabase/make-admin.sql for this email.",
    };
  }

  redirect("/");
}

export async function logout(): Promise<void> {
  if (!supabaseConfigured()) {
    (await cookies()).delete(ADMIN_COOKIE);
  } else {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
