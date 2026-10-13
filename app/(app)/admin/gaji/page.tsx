import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { menitKeJam, rupiah } from "@/lib/time";
import { payrollStartDay, resolvePeriod } from "@/lib/period";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Avatar } from "@/components/Avatar";

type Pay = { talent_id: string; account_code: string; duration_minutes: number | null; amount: number | string; review_status: string; hourly_rate: number | string };

export default async function AdminGaji({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; p?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [period, day] = await Promise.all([resolvePeriod(sp), payrollStartDay()]);
  const supabase = await createClient();
  const [{ data }, { data: talents }, { data: att }] = await Promise.all([
    supabase.from("v_session_pay").select("talent_id, account_code, duration_minutes, amount, review_status, hourly_rate")
      .gte("session_date", period.start).lte("session_date", period.end),
    supabase.from("talents").select("id, nickname, full_name"),
    supabase.from("v_attendance").select("talent_id, state").gte("slot_date", period.start).lte("slot_date", period.end),
  ]);
  const rows = (data ?? []) as Pay[];
  const name = new Map((talents ?? []).map((t) => [t.id, t]));
  const per = new Map<string, { sesi: number; menit: number; gaji: number; cek: number; hadir: number; alpha: number }>();
  rows.forEach((r) => {
    const v = per.get(r.talent_id) ?? { sesi: 0, menit: 0, gaji: 0, cek: 0, hadir: 0, alpha: 0 };
    v.sesi++; v.menit += r.duration_minutes ?? 0; v.gaji += Number(r.amount); if (r.review_status === "needs_review") v.cek++;
    per.set(r.talent_id, v);
  });
  (att ?? []).forEach((a) => {
    const v = per.get(a.talent_id) ?? { sesi: 0, menit: 0, gaji: 0, cek: 0, hadir: 0, alpha: 0 };
    if (a.state === "hadir") v.hadir++; if (a.state === "alpha") v.alpha++;
    per.set(a.talent_id, v);
  });
  const list = [...per.entries()].sort((a, b) => b[1].gaji - a[1].gaji);
  const total = list.reduce((a, [, v]) => ({ gaji: a.gaji + v.gaji, menit: a.menit + v.menit, sesi: a.sesi + v.sesi }), { gaji: 0, menit: 0, sesi: 0 });
  const rate = rows[0] ? Number(rows[0].hourly_rate) : 15000;

  return (
    <>
      <div className="page-head">
        <div><h1>Estimasi gaji</h1><p>{period.label}. Tarif {rupiah(rate)}/jam, dihitung per menit live.</p></div>
        <span className="sticker">{rupiah(total.gaji)}</span>
      </div>
      <PeriodPicker base="/admin/gaji" period={period} startDay={day} />

      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat"><strong>{rupiah(total.gaji)}</strong><span>Total estimasi gaji</span></div>
        <div className="stat"><strong>{menitKeJam(total.menit)}</strong><span>Total jam live</span></div>
        <div className="stat"><strong>{total.sesi}</strong><span>Sesi live</span></div>
        <div className="stat"><strong>{list.filter(([, v]) => v.gaji > 0).length}</strong><span>Talent dibayar</span></div>
      </div>

      <section className="panel flush">
        <div className="band lime"><h2>Per talent</h2><span className="small">urut dari gaji terbesar</span></div>
        {list.length === 0 ? <div className="empty"><strong>Belum ada data</strong>Tidak ada sesi live di rentang ini.</div> : (
          <div className="list">
            {list.map(([id, v]) => {
              const t = name.get(id);
              return (
                <div key={id} className="li">
                  <Avatar name={t?.nickname ?? "?"} />
                  <div>
                    <div className="t">{t?.nickname ?? "?"} <span className="s">{t?.full_name}</span></div>
                    <div className="s">{v.sesi} sesi, {menitKeJam(v.menit)} live, hadir {v.hadir} slot{v.alpha ? `, tidak hadir ${v.alpha}` : ""}</div>
                    {v.cek > 0 && <div className="s"><span className="badge badge-pending">{v.cek} sesi perlu dicek</span> sebelum gaji difinalkan</div>}
                  </div>
                  <div className="r"><strong style={{ fontFamily: "var(--disp)", fontSize: "1.2rem" }}>{rupiah(v.gaji)}</strong></div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="metric-note">Estimasi berdasarkan data live yang tercatat. Sesi bertabrakan atau yang perlu dicek bisa mengubah angka. Selesaikan dulu di <a href="/admin/cek-ulang">Cek tayangan ulang</a> sebelum membayar.</p>
    </>
  );
}
