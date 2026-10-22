import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { payrollStartDay, resolvePeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Avatar } from "@/components/Avatar";
import { SlotPayList, type SlotPay } from "@/components/SlotPayList";

export default async function AdminGaji({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; p?: string; t?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [period, day] = await Promise.all([resolvePeriod(sp), payrollStartDay()]);
  const supabase = await createClient();
  const [{ data }, { data: talents }, { data: accounts }, { data: rate }, { data: att }] = await Promise.all([
    supabase.from("v_slot_pay").select("*").gte("slot_date", period.start).lte("slot_date", period.end)
      .order("slot_date", { ascending: false }).order("sesi"),
    supabase.from("talents").select("id, nickname, full_name"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("pay_rates").select("hourly_rate").order("effective_from", { ascending: false }).limit(1),
    supabase.from("v_attendance").select("talent_id, state").gte("slot_date", period.start).lte("slot_date", period.end),
  ]);
  const rows = (data ?? []) as SlotPay[];
  const name = new Map((talents ?? []).map((t) => [t.id, t]));
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const hourly = Number(rate?.[0]?.hourly_rate ?? 15000);

  type Agg = { sesi: number; gaji: number; menit: number; pel: number; alpha: number; izin: number };
  const per = new Map<string, Agg>();
  const get = (id: string) => per.get(id) ?? { sesi: 0, gaji: 0, menit: 0, pel: 0, alpha: 0, izin: 0 };
  rows.forEach((r) => { const v = get(r.talent_id); v.sesi++; v.gaji += Number(r.amount); v.menit += r.live_minutes; if (r.pelanggaran.length) v.pel++; per.set(r.talent_id, v); });
  (att ?? []).forEach((a) => { const v = get(a.talent_id); if (a.state === "alpha") v.alpha++; if (a.state === "izin") v.izin++; per.set(a.talent_id, v); });
  const list = [...per.entries()].filter(([, v]) => v.sesi + v.alpha + v.izin > 0).sort((a, b) => b[1].gaji - a[1].gaji);
  const total = list.reduce((a, [, v]) => ({ gaji: a.gaji + v.gaji, sesi: a.sesi + v.sesi, pel: a.pel + v.pel }), { gaji: 0, sesi: 0, pel: 0 });
  const detail = sp.t ? rows.filter((r) => r.talent_id === sp.t) : [];
  const qs = (t?: string) => {
    const q = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to, p: sp.p, t }).filter(([, v]) => v) as [string, string][]);
    return `/admin/gaji?${q}`;
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Estimasi gaji</h1><p>{period.label}. {rupiah(4 * hourly)} per sesi 4 jam, {rupiah(2 * hourly)} untuk sesi 22.00–00.00.</p></div>
        <span className="sticker">{rupiah(total.gaji)}</span>
      </div>
      <PeriodPicker base="/admin/gaji" period={period} startDay={day} />

      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><strong>{rupiah(total.gaji)}</strong><span>Total estimasi gaji</span></div>
        <div className="stat"><strong>{total.sesi}</strong><span>Sesi dibayar</span></div>
        <div className="stat"><strong>{total.pel}</strong><span>Sesi dengan pelanggaran</span></div>
        <div className="stat"><strong>{list.filter(([, v]) => v.gaji > 0).length}</strong><span>Talent dibayar</span></div>
      </div>

      <section className="panel flush">
        <div className="band lime"><h2>Per talent</h2><span className="small">klik nama untuk rincian per sesi</span></div>
        {list.length === 0 ? <div className="empty"><strong>Belum ada data</strong>Tidak ada sesi di rentang ini.</div> : (
          <div className="list">
            {list.map(([id, v]) => {
              const t = name.get(id);
              return (
                <div key={id} className="li">
                  <Avatar name={t?.nickname ?? "?"} />
                  <div>
                    <div className="t"><Link href={qs(id)}>{t?.nickname ?? "?"}</Link> <span className="s">{t?.full_name}</span></div>
                    <div className="s">{v.sesi} sesi dibayar, live {menitKeJam(v.menit)}{v.izin ? `, izin ${v.izin}` : ""}{v.alpha ? `, tidak hadir ${v.alpha}` : ""}</div>
                    {v.pel > 0 && <div className="chg"><span className="badge badge-alpha">{v.pel} sesi dengan pelanggaran</span></div>}
                  </div>
                  <div className="r"><strong style={{ fontFamily: "var(--disp)", fontSize: "1.2rem" }}>{rupiah(v.gaji)}</strong></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {sp.t && (
        <section className="panel flush" style={{ marginTop: 20 }}>
          <div className="band sky"><h2>Rincian {name.get(sp.t)?.nickname}</h2><Link href={qs()}>Tutup</Link></div>
          <SlotPayList rows={detail} accName={accName} />
        </section>
      )}
      <p className="metric-note">Sesi dihitung dari absensi: setiap sesi yang dihadiri dibayar penuh dan dibulatkan ke sesi standar menurut jam mulainya. Live yang menyambung lintas sesi digabung ke sesi jadwalnya. Live kurang dari 2 jam, data live kosong, atau tanpa izin tetap dibayar tapi dicatat sebagai pelanggaran.</p>
    </>
  );
}
