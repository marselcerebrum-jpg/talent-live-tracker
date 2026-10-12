import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tanggalPendek } from "@/lib/time";
import { JENIS_IZIN, STATUS_IZIN } from "@/lib/labels";
import { Notice } from "@/components/Notice";
import { putuskanIzin } from "../actions";

export default async function AdminIzin({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: list }, { data: talents }] = await Promise.all([
    supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("talents").select("id, nickname"),
  ]);
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const pending = (list ?? []).filter((l) => l.status === "pending");
  const done = (list ?? []).filter((l) => l.status !== "pending");
  const range = (l: { start_date: string; end_date: string }) =>
    `${tanggalPendek(l.start_date)}${l.end_date !== l.start_date ? ` s.d. ${tanggalPendek(l.end_date)}` : ""}`;

  return (
    <>
      <div className="page-head"><div><h1>Persetujuan izin</h1><p>{pending.length ? `${pending.length} pengajuan menunggu keputusan.` : "Tidak ada pengajuan yang menunggu."}</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      <div className="stack">
        {pending.map((l) => (
          <section key={l.id} className="panel">
            <div className="panel-head">
              <h2>{nick.get(l.talent_id)}: {range(l)}</h2>
              <span className="badge badge-pending">{JENIS_IZIN[l.type]}</span>
            </div>
            <p>{l.reason}</p>
            {l.attachment_url && <p className="small"><a href={l.attachment_url} target="_blank" rel="noreferrer">Lihat bukti</a></p>}
            <form action={putuskanIzin} className="form" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={l.id} />
              <div className="field"><label htmlFor={`n-${l.id}`}>Catatan untuk talent (opsional)</label><input id={`n-${l.id}`} name="review_note" /></div>
              <div className="row">
                <button className="btn btn-ok" type="submit" name="decision" value="approved">Setujui</button>
                <button className="btn btn-bad" type="submit" name="decision" value="rejected">Tolak</button>
              </div>
            </form>
          </section>
        ))}
        <section className="panel">
          <h2 style={{ marginBottom: 12 }}>Riwayat</h2>
          {done.length === 0 ? <p className="muted">Belum ada riwayat.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Talent</th><th>Tanggal</th><th>Jenis</th><th>Alasan</th><th>Status</th></tr></thead>
              <tbody>{done.map((l) => (
                <tr key={l.id}>
                  <td>{nick.get(l.talent_id)}</td><td>{range(l)}</td><td>{JENIS_IZIN[l.type]}</td>
                  <td className="small">{l.reason}{l.review_note && <div className="muted">Catatan: {l.review_note}</div>}</td>
                  <td><span className={`badge badge-${l.status}`}>{STATUS_IZIN[l.status]}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}
