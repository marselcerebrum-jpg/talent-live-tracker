import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hariIni, menitKeJam, rupiah, tanggalPendek } from "@/lib/time";
import { AttendanceTable, monthRange, type AttRow } from "@/components/AttendanceTable";
import { ChangeReport, type ChangeRow } from "@/components/ChangeReport";
import { resolvePeriod } from "@/lib/period";
import { ResetRequests, type ResetReq } from "@/components/ResetRequests";
import { Notice } from "@/components/Notice";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = hariIni();
  const r = monthRange();
  const per = await resolvePeriod({});
  const supabase = await createClient();
  const [{ data: att }, { count: pending }, { count: issues }, { count: review }, { data: pay }, { data: talents }, { data: accounts }, { data: changes }, { count: replay }] = await Promise.all([
    supabase.from("v_attendance").select("*").eq("slot_date", today).order("start_at"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("import_issues").select("id", { count: "exact", head: true }).eq("resolved", false).neq("severity", "info"),
    supabase.from("live_sessions").select("id", { count: "exact", head: true }).eq("review_status", "needs_review"),
    supabase.from("v_session_pay").select("duration_minutes, amount").gte("session_date", per.start).lte("session_date", per.end),
    supabase.from("talents").select("id, nickname"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("schedule_changes").select("*, slot:schedule_slots(account_code, talent_id)")
      .gte("created_at", `${today}T00:00:00+07:00`).order("created_at", { ascending: false }),
    supabase.from("v_replay_queue").select("item_key", { count: "exact", head: true }),
  ]);
  const { data: resets } = await supabase.from("password_reset_requests").select("id, display_name, role, login, requested_at")
    .eq("status", "pending").order("requested_at", { ascending: false });
  const minutes = (pay ?? []).reduce((a, p) => a + (p.duration_minutes ?? 0), 0);
  const amount = (pay ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);

  return (
    <>
      <div className="page-head"><div><h1>Ringkasan</h1></div><span className="sticker">{tanggalPendek(today)}</span></div>
      <Notice ok={sp.ok} e={sp.e} />
      <ResetRequests rows={(resets ?? []) as ResetReq[]} ret="/admin" />

      <section className="panel">
        <div className="stats">
          <div className="stat"><strong>{(att ?? []).length}</strong><span>Slot live hari ini</span></div>
          <div className="stat"><strong>{pending ?? 0}</strong><span><Link href="/admin/izin">Izin menunggu</Link></span></div>
          <div className="stat"><strong>{replay ?? 0}</strong><span><Link href="/admin/cek-ulang">Cek tayangan ulang</Link></span></div>
          <div className="stat"><strong>{menitKeJam(minutes)}</strong><span>Total live {per.label}</span></div>
          <div className="stat"><strong>{rupiah(amount)}</strong><span><Link href="/admin/gaji">Estimasi gaji {per.label}</Link></span></div>
        </div>
      </section>

      <section className="panel flush" style={{ marginTop: 22 }}>
        <div className="band sky"><h2>Laporan perubahan jadwal hari ini</h2><Link href="/admin/absensi">Rekap bulanan</Link></div>
        <ChangeReport rows={(changes ?? []) as ChangeRow[]} nick={new Map((talents ?? []).map((t) => [t.id, t.nickname]))} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} empty="Belum ada laporan hari ini. Semua talent sesuai jadwal." />
      </section>

      <section className="panel flush" style={{ marginTop: 22 }}>
        <div className="band"><h2>Absensi hari ini</h2><Link href="/admin/absensi">Lihat semua</Link></div>
        <AttendanceTable
          rows={(att ?? []) as AttRow[]}
          accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))}
          nick={new Map((talents ?? []).map((t) => [t.id, t.nickname]))}
        />
      </section>
    </>
  );
}
