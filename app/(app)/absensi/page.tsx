import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { AttendanceTable, monthRange, type AttRow } from "@/components/AttendanceTable";

export default async function AbsensiPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/absensi");
  const { m } = await searchParams;
  const r = monthRange(m);
  const supabase = await createClient();
  const [{ data }, { data: accounts }, { data: pay }, { data: dir }] = await Promise.all([
    supabase.from("v_attendance").select("*").eq("talent_id", me.talentId!)
      .gte("slot_date", r.start).lte("slot_date", r.end).order("start_at", { ascending: false }),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("v_slot_pay").select("live_minutes, amount").eq("talent_id", me.talentId!)
      .gte("slot_date", r.start).lte("slot_date", r.end),
    supabase.from("v_talent_directory").select("id, nickname"),
  ]);
  const rows = (data ?? []) as AttRow[];
  const count = (s: string) => rows.filter((x) => x.state === s).length;
  const minutes = (pay ?? []).reduce((a, p) => a + (p.live_minutes ?? 0), 0);
  const amount = (pay ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Absensi</h1><p>{r.label}</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/absensi?m=${r.prev}`}>Bulan sebelumnya</Link>
          <Link className="btn btn-ghost btn-sm" href={`/absensi?m=${r.next}`}>Bulan berikutnya</Link>
        </div>
      </div>
      <section className="panel">
        <div className="stats">
          <div className="stat"><strong>{count("hadir")}</strong><span>Hadir</span></div>
          <div className="stat"><strong>{count("izin")}</strong><span>Izin</span></div>
          <div className="stat"><strong>{count("alpha")}</strong><span>Tidak hadir</span></div>
          <div className="stat"><strong>{menitKeJam(minutes)}</strong><span>Total live</span></div>
          <div className="stat"><strong>{rupiah(amount)}</strong><span>Estimasi bulan kalender. <a href="/gaji">Lihat periode gaji</a></span></div>
        </div>
      </section>
      <section className="panel flush">
        <AttendanceTable rows={rows} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} names={new Map((dir ?? []).map((t) => [t.id, t.nickname]))} />
      </section>
    </>
  );
}
