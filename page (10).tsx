import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/Notice";
import { aturAktif, buatAkun, mulaiLihatSebagai, resetSandi, simpanTalent } from "../actions";
import { displayLogin } from "@/lib/username";

export default async function AdminTalent({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: talents }, { data: profiles }, { data: codes }] = await Promise.all([
    supabase.from("talents").select("id, full_name, nickname, whatsapp, email, is_active").order("is_active", { ascending: false }).order("nickname"),
    supabase.from("profiles").select("id, role, talent_id"),
    supabase.from("promo_codes").select("code, talent_id, is_active"),
  ]);
  const account = new Map((profiles ?? []).filter((p) => p.talent_id).map((p) => [p.talent_id!, p.id]));
  const codesOf = (id: string) => (codes ?? []).filter((c) => c.talent_id === id && c.is_active).map((c) => c.code);
  const noAccount = (talents ?? []).filter((t) => t.is_active && !account.has(t.id));

  return (
    <>
      <div className="page-head"><div><h1>Talent & akun</h1><p>{(talents ?? []).filter((t) => t.is_active).length} talent aktif, {account.size} sudah punya akun login.</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h2>Mode akun bayangan</h2><span className="small muted">lihat aplikasi persis seperti talent, hanya baca</span></div>
        <form action={mulaiLihatSebagai} className="row">
          <select name="talent_id" required defaultValue="" aria-label="Talent" style={{ width: "auto", minWidth: 200 }}>
            <option value="" disabled>Pilih talent</option>
            {(talents ?? []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
          </select>
          <button className="btn" type="submit">Lihat sebagai talent</button>
        </form>
        <p className="metric-note">Semua tombol simpan, absen, dan izin dinonaktifkan selama mode ini. Mode berakhir otomatis setelah 4 jam, atau tekan Kembali ke admin.</p>
      </section>

      <section className="panel">
        <div className="table-wrap"><table>
          <thead><tr><th>Talent</th><th>WhatsApp</th><th>Kode promo</th><th>Username login</th><th /></tr></thead>
          <tbody>{(talents ?? []).map((t) => (
            <tr key={t.id} style={t.is_active ? undefined : { opacity: 0.55 }}>
              <td><strong>{t.nickname}</strong><div className="small muted">{t.full_name}{t.is_active ? "" : " (tidak aktif)"}</div></td>
              <td className="small">{t.whatsapp ?? "–"}</td>
              <td className="small">{codesOf(t.id).join(", ") || "–"}</td>
              <td className="small">
                {account.has(t.id) ? (
                  <details>
                    <summary style={{ cursor: "pointer" }}>{displayLogin(t.email)}</summary>
                    <form action={resetSandi} className="row" style={{ marginTop: 6 }}>
                      <input type="hidden" name="user_id" value={account.get(t.id)} />
                      <input name="password" type="text" minLength={8} placeholder="Sandi baru" aria-label="Sandi baru" style={{ width: 150 }} />
                      <button className="btn btn-sm btn-ghost" type="submit">Atur ulang sandi</button>
                    </form>
                  </details>
                ) : "Belum ada"}
              </td>
              <td className="num">
                <form action={aturAktif}>
                  <input type="hidden" name="id" value={t.id} /><input type="hidden" name="active" value={t.is_active ? "0" : "1"} />
                  <button className="btn btn-ghost btn-sm" type="submit">{t.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>

      <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="panel">
          <h2 style={{ marginBottom: 6 }}>Buat akun login talent</h2>
          <p className="small muted" style={{ marginBottom: 14 }}>Talent login dengan username dan kata sandi ini, tanpa email. Kirimkan lewat WhatsApp; talent bisa mengganti kata sandinya sendiri setelah masuk.</p>
          {noAccount.length === 0 ? <p className="muted">Semua talent aktif sudah punya akun.</p> : (
            <form action={buatAkun} className="form">
              <div className="field">
                <label htmlFor="talent_id">Talent</label>
                <select id="talent_id" name="talent_id" required defaultValue="">
                  <option value="" disabled>Pilih talent</option>
                  {noAccount.map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" required pattern="[a-z0-9][a-z0-9._\-]{2,29}" placeholder="contoh: ginta" autoCapitalize="none" spellCheck={false} /><span className="hint">Huruf kecil, angka, titik, atau strip. Paling mudah pakai nama panggilan.</span></div>
              <div className="field"><label htmlFor="password">Kata sandi awal</label><input id="password" name="password" type="text" minLength={8} required /></div>
              <div className="row"><button className="btn" type="submit">Buat akun</button></div>
            </form>
          )}
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Tambah talent baru</h2>
          <form action={simpanTalent} className="form">
            <div className="field"><label htmlFor="full_name">Nama lengkap</label><input id="full_name" name="full_name" required /></div>
            <div className="field"><label htmlFor="nickname">Nama panggilan</label><input id="nickname" name="nickname" required /><span className="hint">Ditampilkan di jadwal.</span></div>
            <div className="field"><label htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" inputMode="tel" placeholder="62812..." /></div>
            <div className="row"><button className="btn" type="submit">Tambah talent</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
