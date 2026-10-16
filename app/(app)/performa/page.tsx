import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { aggregate, daily, delta, fmtNum, groupBy, type PerfRow } from "@/lib/perf";
import { monthRange } from "@/components/AttendanceTable";
import { BarChart } from "@/components/Chart";
import { DailyMatrix } from "@/components/DailyMatrix";
import { attribute, sumBy, type PromoCode, type PromoDaily } from "@/lib/promo";
import { rupiah } from "@/lib/time";
import { featureOn } from "@/lib/features";

type Bench = { account_code: string; sesi: number; talent_count: number; avg_views: number | null; avg_peak: number | null; avg_watch: number | null; views_per_hour: number | null };

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="muted">–</span>;
  const r = Math.round(v);
  return <span className={r >= 0 ? "delta-up" : "delta-down"}>{r >= 0 ? `${r}% di atas` : `${-r}% di bawah`}</span>;
}

export default async function PerformaSaya({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/performa");
  const { m } = await searchParams;
  const r = monthRange(m);
  const supabase = await createClient();
  const [{ data }, { data: bench }, { data: accounts }, { data: myCodes }, { data: promoDaily }] = await Promise.all([
    supabase.from("live_sessions")
      .select("id, talent_id, account_code, platform, session_date, started_at, duration_minutes, total_views, unique_viewers, peak_concurrent, avg_watch_seconds, active_viewers, topic")
      .eq("talent_id", me.talentId!).gte("session_date", r.start).lte("session_date", r.end),
    supabase.rpc("team_live_benchmark", { p_start: r.start, p_end: r.end }),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("promo_codes").select("code, talent_id, account_code, centil_source_id, valid_from, valid_to, is_active").eq("talent_id", me.talentId!),
    supabase.from("promo_sales_daily").select("centil_source_id, code, sale_date, trx_success, buyers_unique, revenue_idr").gte("sale_date", r.start).lte("sale_date", r.end),
  ]);
  const rows = (data ?? []) as PerfRow[];
  const promoOn = await featureOn("feature_promo");
  const promo = sumBy(attribute((promoDaily ?? []) as PromoDaily[], (myCodes ?? []) as PromoCode[]), (x) => x.code);
  const acc = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const team = new Map(((bench ?? []) as Bench[]).map((b) => [b.account_code, b]));
  const mine = aggregate("me", rows);
  const perAkun = groupBy(rows, (x) => x.account_code).sort((a, b) => b.sesi - a.sesi);
  const best = [...rows].filter((x) => x.total_views !== null).sort((a, b) => (b.total_views ?? 0) - (a.total_views ?? 0)).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div><h1>Performa saya</h1><p>{r.label}</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/performa?m=${r.prev}`}>Bulan sebelumnya</Link>
          <Link className="btn btn-ghost btn-sm" href={`/performa?m=${r.next}`}>Bulan berikutnya</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel empty"><strong>Belum ada data live bulan ini</strong>Data muncul setelah kamu mengisi <Link href="/live/baru">data live</Link>.</div>
      ) : (
        <>
          <section className="panel">
            <div className="stats">
              <div className="stat"><strong>{mine.sesi}</strong><span>Sesi live</span></div>
              <div className="stat"><strong>{menitKeJam(mine.menit)}</strong><span>Total durasi</span></div>
              <div className="stat"><strong>{fmtNum(mine.viewsPerHour)}</strong><span>Tayangan per jam</span></div>
              <div className="stat"><strong>{fmtNum(mine.maxPeak)}</strong><span>Puncak penonton tertinggi</span></div>
            </div>
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 6 }}>Dibanding rata-rata tim</h2>
            <p className="small muted" style={{ marginBottom: 14 }}>Per akun live, karena tiap akun punya jumlah pengikut berbeda. Rata-rata tim mencakup semua talent di akun itu, termasuk kamu.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Akun</th><th className="num">Sesi kamu</th><th>Tayangan per jam</th><th>Rata-rata puncak</th><th>Median tonton</th></tr></thead>
              <tbody>{perAkun.map((a) => {
                const t = team.get(a.key);
                return (
                  <tr key={a.key}>
                    <td><strong>{acc.get(a.key) ?? a.key}</strong>{t && <div className="small muted">{t.talent_count} talent, {t.sesi} sesi</div>}</td>
                    <td className="num">{a.sesi}</td>
                    <td>{fmtNum(a.viewsPerHour)} <span className="small muted">vs {fmtNum(t?.views_per_hour)}</span><div className="small"><Delta v={delta(a.viewsPerHour, t?.views_per_hour ?? null)} /></div></td>
                    <td>{fmtNum(a.avgPeak, 1)} <span className="small muted">vs {fmtNum(t?.avg_peak, 1)}</span><div className="small"><Delta v={delta(a.avgPeak, t?.avg_peak ?? null)} /></div></td>
                    <td>{a.medianWatch === null ? "–" : `${fmtNum(a.medianWatch)} dtk`} <span className="small muted">vs {t?.avg_watch ? `${fmtNum(t.avg_watch)} dtk` : "–"}</span><div className="small"><Delta v={delta(a.medianWatch, t?.avg_watch ?? null)} /></div></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Tayangan per hari</h2><span className="small muted">Batang gelap = hari terbaikmu</span></div>
            <BarChart title="Tayangan TikTok per hari" data={daily(rows, r.start, r.end).map((d) => ({ label: d.date.slice(8), value: d.views }))} />
          </section>

          <section className="panel flush">
            <div className="band sky"><h2>Performa harian</h2><span className="small">per aplikasi</span></div>
            <DailyMatrix rows={rows} keyOf={(x) => x.account_code} nameOf={(k) => acc.get(k) ?? k} />
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 14 }}>5 sesi terbaikmu</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Tanggal</th><th>Akun</th><th className="num">Durasi</th><th className="num">Tayangan</th><th className="num">Puncak</th><th>Materi</th></tr></thead>
              <tbody>{best.map((s) => (
                <tr key={s.id}>
                  <td className="nw">{tanggalPendek(s.session_date)}<div className="small muted">{jam(s.started_at)}</div></td>
                  <td>{acc.get(s.account_code)}</td><td className="num">{menitKeJam(s.duration_minutes)}</td>
                  <td className="num">{fmtNum(s.total_views)}</td><td className="num">{fmtNum(s.peak_concurrent)}</td><td className="small">{s.topic ?? ""}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="metric-note">Materi di sesi terbaik bisa jadi ide untuk live berikutnya.</p>
          </section>
        </>
      )}
      {promoOn && <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Kode promo kamu</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>{(myCodes ?? []).filter((c) => c.is_active).map((c) => c.code).join(", ") || "Belum ada kode promo."}</p>
        {promo.length === 0 ? <p className="muted">Belum ada penjualan dari kode kamu di {r.label}, atau data dari Centil belum masuk.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Kode</th><th className="num">Transaksi</th><th className="num">Pembeli</th><th className="num key">Revenue</th></tr></thead>
            <tbody>{promo.map((p) => <tr key={p.key}><td><strong>{p.key}</strong></td><td className="num">{fmtNum(p.trx)}</td><td className="num">{fmtNum(p.buyers)}</td><td className="num key">{rupiah(p.revenue)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>}
    </>
  );
}
