import type { Metadata } from "next";
import ResetPasswordClient from "@/components/reset-password-client";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const metadata: Metadata = { title: "Choose a new password", robots: PRIVATE_PAGE_ROBOTS };

// Landing page for the password-reset email link. Supabase puts a one-time
// recovery session in the URL; the browser client picks it up.
export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
