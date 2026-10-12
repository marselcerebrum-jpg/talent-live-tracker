import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { aggregate, daily, fmtNum, groupBy, type PerfRow } from "@/lib/perf";
import { monthRange } from "@/components/AttendanceTable";
import { BarChart } from "@/components/Chart";
import { PerfTable } from "@/components/PerfTable";

const COLS = "id, talent_id, account_code, platform, session_date, started_at, duration_minutes, total_views, unique_viewers, peak_concurrent, avg_watch_seconds, active_viewers, topic";

export default async function AdminPerforma({ searchParams }: { searchParams: Promise<{ m?: string; a?: string; t?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const r = monthRange(sp.m);
  const supabase = await createClient();
  let q = supabase.from("live_sessions").select(COLS).gte("session_date", r.start).lte("session_date", r.end);
  if (sp.a) q = q.eq("account_code", sp.a);
  if (sp.t) q = q.eq("talent_id", sp.t);
  const [{ data }, { data: talents }, { data: accounts }] = await Promise.all([
    q, supabase.from("talents").select("id, nickname").order("nickname"), supabase.from("live_accounts").select("code, name").order("name"),
  ]);
  const rows = (data ?? []) as PerfRow[];
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const acc = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const total = aggregate("all", rows);
  const days = daily(rows, r.start, r.end);
  const perTalent = groupBy(rows, (x) => x.talent_id).sort((a, b) => (b.viewsPerHour ?? 0) - (a.viewsPerHour ?? 0));
  const perAkun = groupBy(rows, (x) => x.account_code).sort((a, b) => (b.viewsPerHour ?? 0) - (a.viewsPerHour ?? 0));
  const top = [...rows].filter((x) => x.total_views !== null).sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0)).slice(0, 10);
  const qs = (p: Record<string, string | undefined>) =>
    "/admin/performa?" + new URLSearchParams(Object.entries({ m: r.month, a: sp.a, t: sp.t, ...p }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      <div className="page-head">
        <div><h1>Performa live</h1><p>{r.label}{sp.a ? `, akun ${acc.get(sp.a)}` : ""}{sp.t ? `, ${nick.get(sp.t)}` : ""}</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={qs({ m: r.prev })}>Bulan sebelumnya</Link>
          <Link className="btn btn-ghost btn-sm" href={qs({ m: r.next })}>Bulan berikutnya</Link>
        </div>
      </div>

      <form className="row" action="/admin/performa" style={{ marginBottom: 16 }}>
        <input type="hidden" name="m" value={r.month} />
        <select name="a" defaultValue={sp.a ?? ""} aria-label="Akun" style={{ width: "auto" }}>
          <option value="">Semua akun</option>
          {(accounts ?? []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
        <select name="t" defaultValue={sp.t ?? ""} aria-label="Talent" style={{ width: "auto" }}>
          <option value="">Semua talent</option>
          {(talents ?? []).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>

      {rows.length === 0 ? (
        <div className="panel empty"><strong>Belum ada data live di periode ini</strong>Pilih bulan lain atau ubah filter.</div>
      ) : (
        <>
          <section className="panel">
            <div className="stats">
              <div className="stat"><strong>{total.sesi}</strong><span>Sesi live</span></div>
              <div className="stat"><strong>{menitKeJam(total.menit)}</strong><span>Total durasi</span></div>
              <div className="stat"><strong>{fmtNum(total.views)}</strong><span>Total tayangan TikTok</span></div>
              <div className="stat"><strong>{fmtNum(total.viewsPerHour)}</strong><span>Tayangan per jam live</span></div>
              <div className="stat"><strong>{fmtNum(total.maxPeak)}</strong><span>Puncak penonton tertinggi</span></div>
            </div>
            <p className="metric-note">Tayangan per jam = total tayangan dibagi total jam live. Ini pembanding paling adil antar talent karena durasi live tiap orang berbeda.</p>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Tayangan per hari</h2><span className="small muted">Batang gelap = hari tertinggi</span></div>
            <BarChart title="Tayangan TikTok per hari" data={days.map((d) => ({ label: d.date.slice(8), value: d.views }))} />
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Per talent</h2><span className="small muted">Urut dari tayangan per jam tertinggi</span></div>
            <PerfTable rows={perTalent} label="Talent" name={(k) => nick.get(k) ?? "?"} />
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 14 }}>Per akun</h2>
            <PerfTable rows={perAkun} label="Akun" name={(k) => acc.get(k) ?? k} />
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 14 }}>10 sesi dengan tayangan tertinggi</h2>
            <div className="table-wrap"><table>
              <thead><tr><th /><th>Tanggal</th><th>Talent</th><th>Akun</th><th className="num">Durasi</th><th className="num">Tayangan</th><th className="num">Puncak</th><th>Materi</th></tr></thead>
              <tbody>{top.map((s, i) => (
                <tr key={s.id}>
                  <td className="rank">{i + 1}</td>
                  <td className="nw">{tanggalPendek(s.session_date)}<div className="small muted">{jam(s.started_at)}</div></td>
                  <td>{nick.get(s.talent_id ?? "") ?? "–"}</td><td>{acc.get(s.account_code)}</td>
                  <td className="num">{menitKeJam(s.duration_minutes)}</td><td className="num">{fmtNum(s.total_views)}</td>
                  <td className="num">{fmtNum(s.peak_concurrent)}</td><td className="small">{s.topic ?? ""}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        </>
      )}
    </>
  );
}
