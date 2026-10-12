import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { perbaikiSesi, tandaiIssue } from "../actions";

export default async function PerluDicek({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: sessions }, { data: issues }, { data: talents }, { data: accounts }] = await Promise.all([
    supabase.from("live_sessions")
      .select("id, session_date, started_at, duration_minutes, account_code, talent_id, unique_viewers, total_views, review_reasons, source_ref")
      .eq("review_status", "needs_review").order("session_date", { ascending: false }),
    supabase.from("import_issues").select("id, sheet, ref, issue_code, severity, message")
      .eq("resolved", false).neq("severity", "info").neq("entity", "live_session").order("id"),
    supabase.from("talents").select("id, nickname"),
    supabase.from("live_accounts").select("code, name"),
  ]);
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const hhmm = (iso: string | null) => iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

  return (
    <>
      <div className="page-head"><div><h1>Perlu dicek</h1><p>Sesi live yang datanya meragukan. Perbaiki lalu simpan, dan sesi otomatis ditandai beres.</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      {(sessions ?? []).length === 0 && (issues ?? []).length === 0 && (
        <div className="panel empty"><strong>Semua data sudah beres</strong>Tidak ada yang perlu dicek.</div>
      )}
      <div className="stack">
        {(sessions ?? []).map((s) => (
          <section key={s.id} className="panel">
            <div className="panel-head">
              <h2>{nick.get(s.talent_id ?? "") ?? "Tanpa talent"}: {accName.get(s.account_code)}, {tanggalPendek(s.session_date)}</h2>
              {s.source_ref && <span className="small muted">Sel {s.source_ref} di spreadsheet</span>}
            </div>
            <p className="small" style={{ marginBottom: 12 }}>{(s.review_reasons ?? []).join("; ")}</p>
            <form action={perbaikiSesi} className="form">
              <input type="hidden" name="id" value={s.id} />
              <div className="form-grid">
                <div className="field"><label>Tanggal</label><input name="session_date" type="date" defaultValue={s.session_date} required /></div>
                <div className="field"><label>Jam mulai</label><input name="start_time" type="time" defaultValue={hhmm(s.started_at)} /></div>
                <div className="field"><label>Durasi (menit)</label><input name="duration_minutes" type="number" min={1} max={600} defaultValue={s.duration_minutes ?? ""} required /></div>
                <div className="field"><label>Penonton unik</label><input name="unique_viewers" type="number" min={0} defaultValue={s.unique_viewers ?? ""} /></div>
              </div>
              <div className="row"><button className="btn btn-sm" type="submit">Simpan dan tandai beres</button></div>
            </form>
          </section>
        ))}
        {(issues ?? []).length > 0 && (
          <section className="panel">
            <h2 style={{ marginBottom: 12 }}>Catatan impor lain</h2>
            <div className="table-wrap"><table><tbody>{(issues ?? []).map((i) => (
              <tr key={i.id}>
                <td className="small">{i.sheet} {i.ref}</td><td className="small">{i.message}</td>
                <td className="num"><form action={tandaiIssue}><input type="hidden" name="id" value={i.id} /><button className="btn btn-ghost btn-sm" type="submit">Tandai sudah dicek</button></form></td>
              </tr>
            ))}</tbody></table></div>
          </section>
        )}
      </div>
    </>
  );
}
