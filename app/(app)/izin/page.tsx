import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hariIni, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { ajukanIzin, batalkanIzin } from "../actions";
import { JENIS_IZIN as JENIS, STATUS_IZIN } from "@/lib/labels";


export default async function IzinPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/izin");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("leave_requests")
    .select("id, type, start_date, end_date, reason, status, review_note, created_at")
    .eq("talent_id", me.talentId!).order("created_at", { ascending: false }).limit(30);
  const today = hariIni();

  return (
    <>
      <div className="page-head"><div><h1>Izin</h1><p>Ajukan izin sebelum jadwal live. Slot yang diizinkan tercatat sebagai izin, bukan tidak hadir.</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      <div className="grid-2">
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Ajukan izin</h2>
          <form action={ajukanIzin} className="form">
            <div className="field">
              <label htmlFor="type">Jenis</label>
              <select id="type" name="type" required defaultValue="izin">
                {Object.entries(JENIS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="field"><label htmlFor="start_date">Dari tanggal</label><input id="start_date" name="start_date" type="date" min={today} required defaultValue={today} /></div>
              <div className="field"><label htmlFor="end_date">Sampai tanggal</label><input id="end_date" name="end_date" type="date" min={today} /><span className="hint">Kosongkan kalau hanya satu hari.</span></div>
            </div>
            <div className="field"><label htmlFor="reason">Alasan</label><textarea id="reason" name="reason" required /></div>
            <div className="field"><label htmlFor="attachment_url">Tautan bukti (opsional)</label><input id="attachment_url" name="attachment_url" type="url" placeholder="Link Google Drive surat dokter, dll." /></div>
            <div className="row"><button className="btn" type="submit">Kirim pengajuan</button></div>
          </form>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Riwayat pengajuan</h2>
          {(data ?? []).length === 0 && <p className="muted">Belum ada pengajuan.</p>}
          <div className="stack">
            {(data ?? []).map((l) => (
              <div key={l.id} style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 12 }}>
                <div className="row">
                  <strong>{tanggalPendek(l.start_date)}{l.end_date !== l.start_date ? ` s.d. ${tanggalPendek(l.end_date)}` : ""}</strong>
                  <span className={`badge badge-${l.status}`}>{STATUS_IZIN[l.status]}</span>
                </div>
                <p className="small">{JENIS[l.type]}: {l.reason}</p>
                {l.review_note && <p className="small muted">Catatan admin: {l.review_note}</p>}
                {l.status === "pending" && (
                  <form action={batalkanIzin} style={{ marginTop: 6 }}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="btn btn-bad btn-sm" type="submit">Batalkan</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
