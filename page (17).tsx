import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hariIni } from "@/lib/time";
import { Notice } from "@/components/Notice";
import { RoomConflicts, type RoomConflict } from "@/components/RoomConflicts";
import { aturAktifRuangan, aturRuanganAkun, tambahRuangan } from "../actions";

export default async function Ruangan({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = hariIni();
  const supabase = await createClient();
  const [{ data: rooms }, { data: accounts }, { data: conflicts }, { data: talents }] = await Promise.all([
    supabase.from("rooms").select("id, name, notes, is_active").order("name"),
    supabase.from("live_accounts").select("code, name, room_id, device_note, is_active").order("name"),
    supabase.from("v_room_conflicts").select("*").gte("slot_date", today).lte("slot_date", addDays(today, 14)).order("start_a"),
    supabase.from("talents").select("id, nickname"),
  ]);
  const accName = new Map((accounts ?? []).map((a) => [a.code, a.name]));
  const nick = new Map((talents ?? []).map((t) => [t.id, t.nickname]));
  const usedBy = (roomId: string) => (accounts ?? []).filter((a) => a.room_id === roomId).map((a) => a.name);

  return (
    <>
      <div className="page-head"><div><h1>Ruangan live</h1><p>Setiap aplikasi punya ruangan tetap. Ruangan tampil di jadwal dan kartu Hari ini talent.</p></div></div>
      <Notice ok={sp.ok} e={sp.e} />
      <RoomConflicts rows={(conflicts ?? []) as RoomConflict[]} accName={accName} nick={nick} />

      <section className="panel flush" style={{ marginBottom: 20 }}>
        <div className="band lime"><h2>Aplikasi dan ruangannya</h2><span className="small">simpan per baris</span></div>
        <div className="list">
          {(accounts ?? []).map((a) => (
            <form key={a.code} action={aturRuanganAkun} className="li" style={{ gridTemplateColumns: "40px 1fr" }}>
              <span className="av c2" aria-hidden>{a.name.replace(/^Jadi/i, "").slice(0, 2).toUpperCase()}</span>
              <div className="row">
                <strong style={{ minWidth: 100 }}>{a.name}</strong>
                <input type="hidden" name="account_code" value={a.code} />
                <select name="room_id" defaultValue={a.room_id ?? ""} aria-label={`Ruangan ${a.name}`} style={{ width: "auto", minWidth: 170 }}>
                  <option value="">Belum ditentukan</option>
                  {(rooms ?? []).filter((r) => r.is_active || r.id === a.room_id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input name="device_note" defaultValue={a.device_note ?? ""} placeholder="Perangkat, mis. Totebag Hijau" aria-label={`Perangkat ${a.name}`} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn btn-sm" type="submit">Simpan</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel flush">
          <div className="band sky"><h2>Daftar ruangan</h2></div>
          <div className="list">
            {(rooms ?? []).map((r) => (
              <div key={r.id} className="li" style={r.is_active ? undefined : { opacity: 0.55 }}>
                <span className="av c3" aria-hidden>R</span>
                <div>
                  <div className="t">{r.name}</div>
                  <div className="s">{usedBy(r.id).join(", ") || "Belum dipakai aplikasi mana pun"}{r.notes ? `. ${r.notes}` : ""}</div>
                </div>
                <form action={aturAktifRuangan}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.is_active ? "0" : "1"} />
                  <button className="btn btn-ghost btn-sm" type="submit">{r.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                </form>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Tambah ruangan</h2>
          <form action={tambahRuangan} className="form">
            <div className="field"><label htmlFor="name">Nama ruangan</label><input id="name" name="name" required placeholder="mis. Studio 3" /></div>
            <div className="field"><label htmlFor="notes">Catatan</label><input id="notes" name="notes" placeholder="mis. lantai 2, ada TV" /></div>
            <div className="row"><button className="btn" type="submit">Tambah ruangan</button></div>
          </form>
        </section>
      </div>
      <p className="metric-note">Beberapa aplikasi boleh memakai ruangan yang sama selama jadwalnya tidak bertabrakan. Kalau bertabrakan, muncul peringatan di halaman ini dan di Kelola jadwal.</p>
    </>
  );
}
