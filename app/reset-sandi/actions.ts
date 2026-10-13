"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function simpanSandiBaru(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const a = String(formData.get("password") ?? "");
  const b = String(formData.get("password2") ?? "");
  const back = (e: string) => redirect(`/reset-sandi?token_hash=${encodeURIComponent(tokenHash)}&e=${e}`);
  if (!tokenHash) redirect("/lupa-sandi?e=link");
  if (a.length < 8) back("pendek");
  if (a !== b) back("beda");

  const supabase = await createClient();
  const { error: vErr } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (vErr) redirect("/lupa-sandi?e=link");
  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) back("gagal");
  redirect("/?ok=sandi");
}
