"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notify";

export async function mintaResetSandi(formData: FormData) {
  const login = String(formData.get("login") ?? "").trim();
  if (!login) redirect("/lupa-sandi?e=kosong");
  const supabase = await createClient();
  const { data: name } = await supabase.rpc("request_password_reset", { p_login: login });
  if (typeof name === "string" && name) {
    const h = await headers();
    const site = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const status = await notifyAdmins(
      `Permintaan ubah kata sandi: ${name}`,
      `<p><strong>${name.replace(/[<>&"]/g, "")}</strong> minta kata sandinya di Live Hub diubah.</p>
       <p><a href="${site}/admin">Buka aplikasi untuk membuat kata sandi baru</a></p>
       <p>Setelah diubah, kabari yang bersangkutan lewat WhatsApp.</p>`,
    );
    // catat hasil kirim email supaya mudah dicek bila email tidak sampai
    try {
      const svc = createServiceClient();
      const { data: last } = await svc.from("password_reset_requests").select("id")
        .eq("display_name", name).eq("status", "pending").order("requested_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await svc.from("password_reset_requests").update({ notify_status: status }).eq("id", last.id);
    } catch { /* abaikan */ }
  }
  // pesan selalu sama, tidak membocorkan apakah akun ada
  redirect("/lupa-sandi?ok=1");
}
