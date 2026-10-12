import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
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
  const supabase = await createClient();

  const [{ data: rows }, { data: accounts }, { data: checkins }] = await Promise.all([
    supabase.from("v_attendance")
      .select("slot_id, account_code, slot_date, start_at, end_at, is_event, state, jam_absen, check_in_source, live_minutes, session_count")
      .eq("talent_id", me.talentId!)
      .gte("slot_date", today).lte("slot_date", addDays(today, 6))
      .order("start_at"),
    supabase.from("live_accounts").select("code, name"),
    supabase.from("attendance_checkins").select("slot_id, checked_in_at, checked_out_at").eq("talent_id", me.talentId!)
      .gte("checked_in_at", `${addDays(today, -1)}T00:00:00+07:00`),
  ]);

  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const ci = new Map((checkins ?? []).map((c) => [c.slot_id, c]));
  const slots = (rows ?? []) as Att[];
  const todays = slots.filter((s) => s.slot_date === today);
  const upcoming = slots.filter((s) => s.slot_date !== today);
  const now = Date.now();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Halo, {me.nickname ?? "talent"}</h1>
          <p>{tanggalPendek(today)}. {todays.length ? `Kamu punya ${todays.length} slot live hari ini.` : "Tidak ada slot live hari ini."}</p>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />

      {todays.length > 0 ? (
        <section className="today" aria-label="Slot hari ini">
          {todays.map((s) => {
            const start = new Date(s.start_at).getTime();
            const end = new Date(s.end_at).getTime();
            const inWindow = now >= start - 60 * 60_000 && now <= end;
            const c = ci.get(s.slot_id);
            const onAir = c && !c.checked_out_at;
            return (
              <div key={s.slot_id} className={`slot${inWindow ? " is-now" : ""}`}>
                <div className="slot-time">{jam(s.start_at)}<small>s.d. {jam(s.end_at)}</small></div>
                <div className="slot-body">
                  <div className="slot-meta">
                    <span className="slot-acc">{accName.get(s.account_code) ?? s.account_code}</span>
                    {s.is_event && <span className="badge">Event</span>}
                    {onAir ? <span className="badge badge-live">Sedang live</span>
                      : <span className={`badge badge-${s.state}`}>{STATUS[s.state] ?? s.state}</span>}
                  </div>
                  <p className="muted small">
                    {s.jam_absen ? `Absen pukul ${s.jam_absen}${s.check_in_source === "data_live" ? " (dari data live)" : ""}` : "Belum absen"}
                    {s.live_minutes > 0 && `. Live ${menitKeJam(s.live_minutes)} dalam ${s.session_count} sesi.`}
                  </p>

                  {inWindow && !c && (
                    <form action={absen} className="tally-form">
                      <input type="hidden" name="slot_id" value={s.slot_id} />
                      <button className="tally" type="submit">
                        <span className="tally-lamp" aria-hidden />
                        <span>Absen<small>Jam dicatat otomatis saat kamu menekan tombol ini</small></span>
                      </button>
                    </form>
                  )}
                  {onAir && (
                    <>
                      <div className="onair"><span className="dot" aria-hidden /> Kamu sedang live. Setelah selesai, tekan Selesai live lalu isi data live.</div>
                      <form action={selesaiLive} className="row" style={{ marginTop: 12 }}>
                        <input type="hidden" name="slot_id" value={s.slot_id} />
                        <button className="btn" type="submit">Selesai live</button>
                        <a className="btn btn-ghost" href="/live/baru">Isi data live</a>
                      </form>
                    </>
                  )}
                  {c?.checked_out_at && (
                    <p className="small" style={{ marginTop: 10 }}>Selesai pukul {jam(c.checked_out_at)}. <a href="/live/baru">Isi data live</a></p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="panel empty">
          <strong>Tidak ada jadwal live hari ini</strong>
          Lihat jadwal minggu ini di halaman <a href="/jadwal">Jadwal</a>.
        </div>
      )}

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head"><h2>6 hari ke depan</h2><a className="small" href="/jadwal">Lihat kalender</a></div>
        {upcoming.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hari</th><th>Jam</th><th>Akun</th></tr></thead>
              <tbody>
                {upcoming.map((s) => (
                  <tr key={s.slot_id}>
                    <td className="nw">{tanggalPendek(s.slot_date)}</td>
                    <td className="nw">{jam(s.start_at)}–{jam(s.end_at)}</td>
                    <td>{accName.get(s.account_code) ?? s.account_code}{s.is_event ? " (event)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Belum ada slot terjadwal untuk 6 hari ke depan.</p>}
      </section>
    </>
  );
}
