import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni, isYmd, jam, senin, tanggalPanjang, tanggalPendek } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { batalkanSlot, tambahSlot } from "../actions";
import { RoomConflicts, type RoomConflict } from "@/components/RoomConflicts";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const SLOT_UMUM = [["06:00", "10:00"], ["10:00", "14:00"], ["14:00", "18:00"], ["18:00", "22:00"], ["22:00", "00:00"]];

export default async function AdminJadwal({ searchParams }: { searchParams: Promise<{ w?: string; ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const start = senin(isYmd(sp.w) ? sp.w : hariIni());
  const end = addDays(start, 6);
  const supabase = await createClient();
  const [{ data: slots }, { data: talents }, { data: accounts }, { data: conflicts }] = await Promise.all([
    supabase.from("schedule_slots").select("id, account_code, talent_id, start_at, end_at, slot_date, is_event, note, source")
      .eq("status", "scheduled").gte("slot_date", start).lte("slot_date", end).order("start_at"),
    supabase.from("talents").select("id, nickname, is_active").order("nickname"),
    supabase.from("live_accounts").select("code, name").eq("is_active", true).order("name"),
    supabase.from("v_room_conflicts").select("*").gte("slot_date", start).lte("slot_date", end).order("start_a"),
  ]);
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));

  return (
    <>
      <div className="page-head">
        <div><h1>Kelola jadwal</h1><p>{tanggalPanjang(start)} sampai {tanggalPanjang(end)}</p></div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/admin/jadwal?w=${addDays(start, -7)}`}>Minggu lalu</Link>
          <Link className="btn btn-ghost btn-sm" href="/admin/jadwal">Minggu ini</Link>
          <Link className="btn btn-ghost btn-sm" href={`/admin/jadwal?w=${addDays(start, 7)}`}>Minggu depan</Link>
        </div>
      </div>
      <Notice ok={sp.ok} e={sp.e} />
      <RoomConflicts rows={(conflicts ?? []) as RoomConflict[]} accName={accName} nick={nick} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Tambah slot</h2>
          <form action={tambahSlot} className="form">
            <input type="hidden" name="w" value={start} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="account_code">Akun</label>
                <select id="account_code" name="account_code" required defaultValue="">
                  <option value="" disabled>Pilih akun</option>
                  {(accounts ?? []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="talent_id">Talent</label>
                <select id="talent_id" name="talent_id" required defaultValue="">
                  <option value="" disabled>Pilih talent</option>
                  {(talents ?? []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.nickname}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="start_time">Jam mulai</label><input id="start_time" name="start_time" type="time" required defaultValue="14:00" /></div>
              <div className="field"><label htmlFor="end_time">Jam selesai</label><input id="end_time" name="end_time" type="time" required defaultValue="18:00" /><span className="hint">Slot umum: {SLOT_UMUM.map(([a, b]) => `${a}–${b}`).join(", ")}</span></div>
              <div className="field"><label htmlFor="date_from">Tanggal</label><input id="date_from" name="date_from" type="date" required defaultValue={start} /></div>
              <div className="field"><label htmlFor="date_until">Ulangi sampai</label><input id="date_until" name="date_until" type="date" /><span className="hint">Kosongkan untuk satu hari.</span></div>
            </div>
            <fieldset>
              <legend>Hari yang diulang</legend>
              <div className="row">
                {HARI.map((h, i) => (
                  <label key={h} className="row small" style={{ gap: 4 }}>
                    <input type="checkbox" name="dow" value={i} defaultChecked={i < 5} style={{ width: "auto" }} /> {h}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <div className="field"><label htmlFor="note">Catatan</label><input id="note" name="note" /></div>
              <label className="row small" style={{ gap: 6, alignSelf: "end", paddingBottom: 10 }}>
                <input type="checkbox" name="is_event" style={{ width: "auto" }} /> Slot event
              </label>
            </div>
            <div className="row"><button className="btn" type="submit">Simpan slot</button></div>
          </form>
        </section>

        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Slot minggu ini ({(slots ?? []).length})</h2>
          {(slots ?? []).length === 0 && <p className="muted">Belum ada slot di minggu ini. Tambahkan dari form di samping.</p>}
          <div className="table-wrap">
            <table>
              <tbody>
                {(slots ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{tanggalPendek(s.slot_date)}<div className="small muted">{jam(s.start_at)}–{jam(s.end_at)}</div></td>
                    <td>{accName.get(s.account_code) ?? s.account_code}{s.is_event ? " (event)" : ""}<div className="small">{nick.get(s.talent_id)}</div></td>
                    <td className="num">
                      <form action={batalkanSlot}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="w" value={start} />
                        <button className="btn btn-bad btn-sm" type="submit">Batalkan</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
