import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { monthRange } from "@/components/AttendanceTable";
import { Notice } from "@/components/Notice";
import { SessionTable, type SessionRow } from "@/components/SessionTable";

export default async function AdminLive({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; a?: string; ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const r = monthRange(sp.m);
  const supabase = await createClient();
  let q = supabase.from("live_sessions")
    .select("id, session_date, started_at, duration_minutes, account_code, platform, total_views, unique_viewers, peak_concurrent, avg_watch_seconds, topic, review_status, talent_id")
    .gte("session_date", r.start).lte("session_date", r.end)
    .order("session_date", { ascending: false }).order("started_at", { ascending: false });
  if (sp.t) q = q.eq("talent_id", sp.t);
  if (sp.a) q = q.eq("account_code", sp.a);
  const [{ data }, { data: talents }, { data: accounts }, { data: rate }] = await Promise.all([
    q, supabase.from("talents").select("id, nickname").order("nickname"),
    supabase.from("live_accounts").select("code, name").order("name"),
    supabase.from("pay_rates").select("hourly_rate").order("effective_from", { ascending: false }).limit(1),
  ]);
  const rows = (data ?? []) as SessionRow[];
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const hourly = Number(rate?.[0]?.hourly_rate ?? 0);

  // rekap per talent
  const per = new Map<string, { menit: number; sesi: number }>();
  rows.forEach((x) => {
    if (!x.talent_id) return;
    const v = per.get(x.talent_id) ?? { menit: 0, sesi: 0 };
    v.menit += x.duration_minutes ?? 0; v.sesi += 1; per.set(x.talent_id, v);
  });
  const rekap = [...per.entries()].sort((a, b) => b[1].menit - a[1].menit);

  return (
    <>
      <div className="page-head">
        <div><h1>Data live tim</h1><p>{r.label}: {rows.length} sesi.</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/admin/live?m=${r.prev}`}>Bulan sebelumnya</Link>
          <Link className="btn btn-ghost btn-sm" href={`/admin/live?m=${r.next}`}>Bulan berikutnya</Link>
          <Link className="btn btn-sm" href="/admin/live/baru">Isi data live</Link>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />
      <section className="panel">
        <div className="panel-head"><h2>Rekap per talent</h2><span className="small muted">Gaji dihitung per sesi di <a href="/admin/gaji">Estimasi gaji</a></span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Talent</th><th className="num">Sesi</th><th className="num">Total live</th></tr></thead>
          <tbody>{rekap.map(([id, v]) => (
            <tr key={id}><td>{nick.get(id)}</td><td className="num">{v.sesi}</td><td className="num">{menitKeJam(v.menit)}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <form className="row" action="/admin/live" style={{ margin: "16px 0" }}>
        <input type="hidden" name="m" value={r.month} />
        <select name="t" defaultValue={sp.t ?? ""} aria-label="Talent" style={{ width: "auto" }}>
          <option value="">Semua talent</option>
          {(talents ?? []).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
        </select>
        <select name="a" defaultValue={sp.a ?? ""} aria-label="Akun" style={{ width: "auto" }}>
          <option value="">Semua akun</option>
          {(accounts ?? []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>
      <section className="panel flush">
        <SessionTable rows={rows} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} nick={nick} />
      </section>
    </>
  );
}
