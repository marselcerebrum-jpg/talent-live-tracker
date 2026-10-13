"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USER_DOMAIN } from "@/lib/username";

export async function kirimLinkReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@") || email.endsWith(`@${USER_DOMAIN}`)) redirect("/lupa-sandi?e=talent");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${proto}://${host}/auth/reset` });
  // Pesan selalu sama supaya tidak membocorkan apakah email terdaftar.
  if (error && /rate|limit/i.test(error.message)) redirect("/lupa-sandi?e=limit");
  redirect("/lupa-sandi?ok=1");
}
