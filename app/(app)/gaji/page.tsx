import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { payrollStartDay, resolvePeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/PeriodPicker";
import { SlotPayList, type SlotPay } from "@/components/SlotPayList";

export default async function GajiSaya({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; p?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin/gaji");
  const sp = await searchParams;
  const [period, day] = await Promise.all([resolvePeriod(sp), payrollStartDay()]);
  const supabase = await createClient();
  const [{ data }, { data: accounts }, { data: rate }] = await Promise.all([
    supabase.from("v_slot_pay").select("*").eq("talent_id", me.talentId!)
      .gte("slot_date", period.start).lte("slot_date", period.end).order("slot_date", { ascending: false }).order("sesi"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("pay_rates").select("hourly_rate").order("effective_from", { ascending: false }).limit(1),
  ]);
  const rows = (data ?? []) as SlotPay[];
  const gaji = rows.reduce((a, r) => a + Number(r.amount), 0);
  const menit = rows.reduce((a, r) => a + r.live_minutes, 0);
  const pel = rows.filter((r) => r.pelanggaran.length).length;
  const hourly = Number(rate?.[0]?.hourly_rate ?? 15000);

  return (
    <>
      <div className="page-head">
        <div><h1>Estimasi gaji</h1><p>{period.label}. Dihitung per sesi yang kamu hadiri.</p></div>
        <span className="sticker">{rupiah(gaji)}</span>
      </div>
      <PeriodPicker base="/gaji" period={period} startDay={day} />
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><strong>{rupiah(gaji)}</strong><span>Estimasi gaji</span></div>
        <div className="stat"><strong>{rows.length}</strong><span>Sesi dihadiri</span></div>
        <div className="stat"><strong>{menitKeJam(menit)}</strong><span>Total live</span></div>
        <div className="stat"><strong>{pel}</strong><span>Sesi dengan catatan pelanggaran</span></div>
      </div>
      <section className="panel flush">
        <div className="band lime"><h2>Rincian per sesi</h2><span className="small">{rupiah(4 * hourly)} per sesi 4 jam, {rupiah(2 * hourly)} sesi 22.00–00.00</span></div>
        <SlotPayList rows={rows} accName={new Map((accounts ?? []).map((a) => [a.code, a.name]))} />
      </section>
      <p className="metric-note">Estimasi, belum final. Sesi tetap dibayar penuh walau ada catatan pelanggaran (misalnya live kurang dari 2 jam), tapi catatan itu dipakai untuk evaluasi.</p>
    </>
  );
}
