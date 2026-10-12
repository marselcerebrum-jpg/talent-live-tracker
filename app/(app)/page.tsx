import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, jam, menitKeJam, rupiah, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { Avatar } from "@/components/Avatar";
import { monthRange } from "@/components/AttendanceTable";
import { absen, selesaiLive } from "./actions";

type Att = {
  slot_id: string; account_code: string; slot_date: string; start_at: string; end_at: string; is_event: boolean;
  state: string; jam_absen: string | null; check_in_source: string | null; live_minutes: number; session_count: number;
};
const STATUS: Record<string, string> = { terjadwal: "Terjadwal", hadir: "Hadir", izin: "Izin", alpha: "Tidak hadir", telat: "Telat" };

export default async function Beranda({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await getMe();
  if (me.role === "admin") redirect("/admin");
  const sp = await searchParams;
  const today = hariIni();
  const r = monthRange();
  const supabase = await createClient();

  const [{ data: rows }, { data: accounts }, { data: checkins }, { data: month }, { data: pay }] = await Promise.all([
    supabase.from("v_attendance")
      .select("slot_id, account_code, slot_date, start_at, end_at, is_event, state, jam_absen, check_in_source, live_minutes, session_count")
      .eq("talent_id", me.talentId!).gte("slot_date", today).lte("slot_date", addDays(today, 6)).order("start_at"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("attendance_checkins").select("slot_id, checked_in_at, checked_out_at").eq("talent_id", me.talentId!)
      .gte("checked_in_at", `${addDays(today, -1)}T00:00:00+07:00`),
    supabase.from("v_attendance").select("state").eq("talent_id", me.talentId!).gte("slot_date", r.start).lte("slot_date", today),
    supabase.from("v_session_pay").select("duration_minutes, amount").eq("talent_id", me.talentId!).gte("session_date", r.start).lte("session_date", r.end),
  ]);

  const accName = (c: string) => (accounts ?? []).find((a) => a.code === c)?.name ?? c;
  const ci = new Map((checkins ?? []).map((c) => [c.slot_id, c]));
  const slots = (rows ?? []) as Att[];
  const now = Date.now();
  const todays = slots.filter((s) => s.slot_date === today);
  const focus = todays.find((s) => now <= new Date(s.end_at).getTime());
  const rest = slots.filter((s) => s !== focus && new Date(s.end_at).getTime() >= now);
  const past = (month ?? []).filter((m) => m.state !== "terjadwal");
  const hadir = past.filter((m) => m.state === "hadir").length;
  const menit = (pay ?? []).reduce((a, p) => a + (p.duration_minutes ?? 0), 0);
  const gaji = (pay ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);

  let hero: React.ReactNode;
  if (!focus) {
    hero = (
      <section className="hero is-done">
        <span className="blob" aria-hidden />
        <span className="badge">{todays.length ? "Selesai untuk hari ini" : "Libur live"}</span>
        <div className="acc">{todays.length ? "Kerja bagus!" : "Tidak ada slot"}</div>
        <p className="meta">{todays.length ? "Semua slot hari ini sudah lewat. Pastikan data live sudah diisi." : "Kamu tidak punya jadwal live hari ini."}</p>
        {todays.length > 0 && <a className="btn" href="/live/baru" style={{ marginTop: 14 }}>Isi data live</a>}
      </section>
    );
  } else {
    const start = new Date(focus.start_at).getTime();
    const inWindow = now >= start - 60 * 60_000;
    const c = ci.get(focus.slot_id);
    const onAir = c && !c.checked_out_at;
    const done = c?.checked_out_at;
    hero = (
      <section className={`hero${onAir ? " is-live" : done ? " is-done" : ""}`}>
        <span className="blob" aria-hidden />
        {onAir ? <span className="badge badge-live">Sedang live</span>
          : done ? <span className="badge badge-hadir">Selesai {jam(done)}</span>
          : inWindow ? <span className="badge badge-live">Slot dibuka</span>
          : <span className="badge">Nanti</span>}
        <div className="acc">{accName(focus.account_code)}</div>
        <div className="time">{jam(focus.start_at)}–{jam(focus.end_at)}{focus.is_event ? ", event" : ""}</div>
        {focus.jam_absen && <p className="meta">Absen pukul {focus.jam_absen}{focus.check_in_source === "data_live" ? " (dari data live)" : ""}</p>}

        {inWindow && !c && (
          <form action={absen}>
            <input type="hidden" name="slot_id" value={focus.slot_id} />
            <button className="tally" type="submit"><span className="tally-lamp" aria-hidden />Absen sekarang</button>
            <p className="tally-hint">Jam dicatat otomatis saat tombol ditekan</p>
          </form>
        )}
        {!inWindow && !c && <p className="meta">Tombol absen muncul pukul {jam(new Date(start - 60 * 60_000).toISOString())}.</p>}
        {onAir && (
          <>
            <div className="onair"><span className="dot" aria-hidden />Absen {jam(c!.checked_in_at)}. Tekan Selesai live setelah selesai.</div>
            <form action={selesaiLive} className="row" style={{ marginTop: 12 }}>
              <input type="hidden" name="slot_id" value={focus.slot_id} />
              <button className="btn" type="submit">Selesai live</button>
              <a className="btn btn-ghost" href="/live/baru">Isi data live</a>
            </form>
          </>
        )}
        {done && <a className="btn" href="/live/baru" style={{ marginTop: 14 }}>Isi data live</a>}
      </section>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Hai, {me.nickname ?? "talent"}!</h1><p>{tanggalPendek(today)}</p></div>
        <span className="sticker">{todays.length} slot hari ini</span>
      </div>
      <Notice ok={sp.ok} e={sp.e} />
      {hero}

      <div className="sect"><span>Berikutnya</span><a href="/jadwal">Kalender</a></div>
      <section className="panel flush">
        {rest.length === 0 ? <p className="muted" style={{ padding: 20 }}>Belum ada slot lain dalam 6 hari ke depan.</p> : (
          <div className="list">
            {rest.slice(0, 6).map((s) => (
              <div key={s.slot_id} className="li">
                <Avatar name={accName(s.account_code)} />
                <div>
                  <div className="t">{accName(s.account_code)}{s.is_event ? " (event)" : ""}</div>
                  <div className="s">{s.slot_date === today ? "Hari ini" : tanggalPendek(s.slot_date)}, {jam(s.start_at)}–{jam(s.end_at)}</div>
                </div>
                <span className={`badge badge-${s.state}`}>{s.slot_date === today ? "Nanti" : STATUS[s.state] ?? s.state}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="sect"><span>Bulan ini</span><a href="/absensi">Detail</a></div>
      <div className="stats">
        <div className="stat"><strong>{hadir}/{past.length}</strong><span>Hadir</span></div>
        <div className="stat"><strong>{rupiah(gaji)}</strong><span>Estimasi gaji</span></div>
        <div className="stat"><strong>{menitKeJam(menit)}</strong><span>Total live</span></div>
      </div>
    </>
  );
}
