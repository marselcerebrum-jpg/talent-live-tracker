import { createServiceClient } from "@/lib/supabase/server";

/**
 * Kirim email pemberitahuan ke admin lewat Resend (https://resend.com).
 * Env: RESEND_API_KEY (wajib untuk kirim), ADMIN_NOTIFY_EMAILS (opsional, dipisah koma; default semua admin),
 *      RESEND_FROM (opsional, default "Talent Live <onboarding@resend.dev>").
 * Tidak melempar error: kalau gagal/tidak diatur, permintaan tetap tampil di aplikasi admin.
 */
export async function notifyAdmins(subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    let to = (process.env.ADMIN_NOTIFY_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!to.length) {
      const svc = createServiceClient();
      const { data: profs } = await svc.from("profiles").select("id").eq("role", "admin");
      const users = await Promise.all((profs ?? []).map((p) => svc.auth.admin.getUserById(p.id)));
      to = users.map((u) => u.data.user?.email).filter((e): e is string => !!e);
    }
    if (!to.length) return false;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Talent Live <onboarding@resend.dev>", to, subject, html }),
    });
    if (!res.ok) console.error("Resend gagal:", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("notifyAdmins error:", e);
    return false;
  }
}
