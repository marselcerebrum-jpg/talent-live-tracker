import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { Avatar } from "@/components/Avatar";
import { resetSandiAdmin, tambahAdmin } from "../actions";
import { ResetRequests, type ResetReq } from "@/components/ResetRequests";
import { createClient } from "@/lib/supabase/server";

export default async function KelolaAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  let admins: { id: string; email: string; last: string | null; created: string }[] = [];
  let configError = "";
  try {
    const svc = createServiceClient();
    const { data: profs } = await svc.from("profiles").select("id").eq("role", "admin");
    const users = await Promise.all((profs ?? []).map((p) => svc.auth.admin.getUserById(p.id)));
    admins = users.map((u) => u.data.user).filter(Boolean).map((u) => ({
      id: u!.id, email: u!.email ?? "?", last: u!.last_sign_in_at ?? null, created: u!.created_at,
    }));
  } catch (e) {
    configError = (e as Error).message;
  }

  const { data: resetData } = await (await createClient()).from("password_reset_requests")
    .select("id, display_name, role, login, requested_at").eq("status", "pending").order("requested_at", { ascending: false });
  const resets = resetData ?? [];

  return (
    <>
      <div className="page-head"><div><h1>Kelola admin</h1><p>Admin bisa melihat semua data, mengatur jadwal, menyetujui izin, dan membuat akun.</p></div></div>
      <Notice ok={sp.ok} e={sp.e || configError || undefined} />
      <ResetRequests rows={resets as ResetReq[]} ret="/admin/admin" />
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel flush">
          <div className="band lime"><h2>Daftar admin ({admins.length})</h2></div>
          <div className="list">
            {admins.map((a) => (
              <div key={a.id} className="li">
                <Avatar name={a.email} />
                <div>
                  <div className="t">{a.email}{a.id === me.userId && <span className="s"> (kamu)</span>}</div>
                  <div className="s">{a.last ? `Terakhir masuk ${tanggalPendek(a.last)}` : "Belum pernah masuk"}</div>
                  {a.id !== me.userId ? (
                    <details>
                      <summary className="small">Atur ulang kata sandi</summary>
                      <form action={resetSandiAdmin} className="row" style={{ marginTop: 8 }}>
                        <input type="hidden" name="user_id" value={a.id} />
                        <input name="password" type="text" minLength={8} required placeholder="Sandi baru, min. 8 karakter" aria-label="Sandi baru" style={{ flex: 1, minWidth: 180 }} />
                        <button className="btn btn-sm" type="submit">Simpan</button>
                      </form>
                    </details>
                  ) : (
                    <a className="small" href="/akun">Ganti sandi saya</a>
                  )}
                </div>
                <span className="badge">Admin</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>Tambah admin</h2>
          <p className="small muted" style={{ marginBottom: 14 }}>Pakai email asli (misalnya Gmail) supaya bisa memakai fitur Lupa kata sandi.</p>
          <form action={tambahAdmin} className="form">
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="password">Kata sandi awal</label><input id="password" name="password" type="text" minLength={8} required /><span className="hint">Minta admin baru menggantinya setelah masuk.</span></div>
            <div className="row"><button className="btn" type="submit">Tambah admin</button></div>
          </form>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Kalau ada yang lupa kata sandi</h2>
        <p className="small">Talent: atur ulang di <a href="/admin/talent">Talent &amp; akun</a>. Siapa pun yang lupa bisa menekan <strong>Lupa kata sandi?</strong> di halaman login. Admin menerima email pemberitahuan dan permintaannya muncul di Ringkasan untuk langsung dibuatkan sandi baru.</p>
      </section>
    </>
  );
}
