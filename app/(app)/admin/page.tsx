import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hariIni, menitKeJam, rupiah, tanggalPendek } from "@/lib/time";
import { AttendanceTable, monthRange, type AttRow } from "@/components/AttendanceTable";

export default async function AdminHome() {
  await requireAdmin();
  const today = hariIni();
  const r = monthRange();
  const supabase = await createClient();
  const [{ data: att }, { count: pending }, { count: issues }, { count: review }, { data: pay }, { data: talents }, { data: accounts }] = await Promise.all([
    supabase.from("v_attendance").select("*").eq("slot_date", today).order("start_at"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("import_issues").select("id", { count: "exact", head: true }).eq("resolved", false).neq("severity", "info"),
    supabase.from("live_sessions").select("id", { count: "exact", head: true }).eq("review_status", "needs_review"),
    supabase.from("v_session_pay").select("duration_minutes, amount").gte("session_date", r.start).lte("session_date", r.end),
    supabase.from("talents").select("id, nickname"),
    supabase.from("live_accounts").select("code, name"),
  ]);
  const minutes = (pay ?? []).reduce((a, p) => a + (p.duration_minutes ?? 0), 0);
  const amount = (pay ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);

  return (
    <>
      <div className="page-head"><div><h1>Ringkasan</h1></div><span className="sticker">{tanggalPendek(today)}</span></div>

      <section className="panel">
        <div className="stats">
          <div className="stat"><strong>{(att ?? []).length}</strong><span>Slot live hari ini</span></div>
          <div className="stat"><strong>{pending ?? 0}</strong><span><Link href="/admin/izin">Izin menunggu</Link></span></div>
          <div className="stat"><strong>{Math.max(issues ?? 0, review ?? 0)}</strong><span><Link href="/admin/perlu-dicek">Data perlu dicek</Link></span></div>
          <div className="stat"><strong>{menitKeJam(minutes)}</strong><span>Total live {r.label}</span></div>
          <div className="stat"><strong>{rupiah(amount)}</strong><span>Estimasi gaji {r.label}</span></div>
        </div>
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
