import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { payrollStartDay, resolvePeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/PeriodPicker";
import { SessionTable, type SessionRow } from "@/components/SessionTable";

export default async function GajiSaya({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; p?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/gaji");
  const sp = await searchParams;
  const [period, day] = await Promise.all([resolvePeriod(sp), payrollStartDay()]);
  const supabase = await createClient();
  const [{ data: pay }, { data: sessions }, { data: accounts }] = await Promise.all([
    supabase.from("v_session_pay").select("duration_minutes, amount, hourly_rate").eq("talent_id", me.talentId!)
      .gte("session_date", period.start).lte("session_date", period.end),
    supabase.from("live_sessions")
      .select("id, session_date, started_at, duration_minutes, account_code, platform, total_views, unique_viewers, peak_concurrent, avg_watch_seconds, topic, review_status, talent_id")
      .eq("talent_id", me.talentId!).gte("session_date", period.start).lte("session_date", period.end)
      .order("session_date", { ascending: false }).order("started_at", { ascending: false }),
    supabase.from("live_accounts").select("code, name"),
  ]);
  const gaji = (pay ?? []).reduce((a, p) => a + Number(p.amount), 0);
  const menit = (pay ?? []).reduce((a, p) => a + (p.duration_minutes ?? 0), 0);
  const rate = pay?.[0] ? Number(pay[0].hourly_rate) : 15000;

  return (
    <>
      <div className="page-head">
        <div><h1>Estimasi gaji</h1><p>{period.label}</p></div>
        <span className="sticker">{rupiah(gaji)}</span>
      </div>
      <PeriodPicker base="/gaji" period={period} startDay={day} />
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><strong>{rupiah(gaji)}</strong><span>Estimasi gaji</span></div>
        <div className="stat"><strong>{menitKeJam(menit)}</strong><span>Total live</span></div>
        <div className="stat"><strong>{(sessions ?? []).length}</strong><span>Sesi</span></div>
        <div className="stat"><strong>{rupiah(rate)}</strong><span>Tarif per jam</span></div>
      </div>
      <section className="panel flush">
        <div className="band lime"><h2>Sesi yang dihitung</h2></div>
        <SessionTable rows={(sessions ?? []) as SessionRow[]} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} />
      </section>
      <p className="metric-note">Estimasi, belum final. Gaji dihitung per menit dari durasi live yang kamu isi di Data live. Pastikan semua sesi sudah diisi.</p>
    </>
  );
}
