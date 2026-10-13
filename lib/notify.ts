import { createServiceClient } from "@/lib/supabase/server";

/**
 * Kirim email pemberitahuan ke admin lewat Resend (https://resend.com), satu email per penerima
 * supaya satu penerima yang ditolak tidak menggagalkan yang lain.
 * Env: RESEND_API_KEY (wajib), ADMIN_NOTIFY_EMAILS (opsional, dipisah koma; default semua admin),
 *      RESEND_FROM (opsional, default "Live Hub <onboarding@resend.dev>").
 * Tidak melempar error. Mengembalikan ringkasan hasil untuk dicatat di database.
 */
export async function notifyAdmins(subject: string, html: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "tidak dikirim: RESEND_API_KEY belum diisi di Vercel (atau belum redeploy)";
  let to: string[] = [];
  try {
    to = (process.env.ADMIN_NOTIFY_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!to.length) {
      const svc = createServiceClient();
      const { data: profs } = await svc.from("profiles").select("id").eq("role", "admin");
      const users = await Promise.all((profs ?? []).map((p) => svc.auth.admin.getUserById(p.id)));
      to = users.map((u) => u.data.user?.email).filter((e): e is string => !!e);
    }
  } catch (e) {
    return `gagal membaca daftar admin: ${(e as Error).message}`.slice(0, 300);
  }
  if (!to.length) return "tidak dikirim: tidak ada email penerima";

  const results = await Promise.all(to.map(async (addr) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.RESEND_FROM || "Live Hub <onboarding@resend.dev>", to: [addr], subject, html }),
      });
      if (res.ok) return `${addr}: ok`;
      const body = await res.text();
      let msg = body;
      try { msg = JSON.parse(body).message ?? body; } catch { /* teks biasa */ }
      return `${addr}: gagal ${res.status} ${msg}`.slice(0, 200);
    } catch (e) {
      return `${addr}: error ${(e as Error).message}`.slice(0, 200);
    }
  }));
  const summary = results.join(" | ");
  console.log("notifyAdmins:", summary);
  return summary;
}
