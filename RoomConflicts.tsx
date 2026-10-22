import { jam, tanggalPendek } from "@/lib/time";

export type RoomConflict = {
  room_name: string; account_a: string; talent_a: string; start_a: string; end_a: string;
  account_b: string; talent_b: string; start_b: string; end_b: string; slot_date: string;
};

/** Peringatan dua aplikasi terjadwal di ruangan yang sama pada jam yang sama. */
export function RoomConflicts({ rows, accName, nick }: { rows: RoomConflict[]; accName: Map<string, string>; nick: Map<string, string> }) {
  if (!rows.length) return null;
  return (
    <section className="panel flush" style={{ marginBottom: 20 }}>
      <div className="band pink"><h2>Bentrok ruangan ({rows.length})</h2><span className="small">dua live di ruangan yang sama</span></div>
      <div className="list">
        {rows.map((c, i) => (
          <div key={i} className="li">
            <span className="av c1" aria-hidden>!</span>
            <div>
              <div className="t">{c.room_name}, {tanggalPendek(c.slot_date)}</div>
              <div className="s">{accName.get(c.account_a) ?? c.account_a} ({nick.get(c.talent_a) ?? "?"}) {jam(c.start_a)}–{jam(c.end_a)} bentrok dengan {accName.get(c.account_b) ?? c.account_b} ({nick.get(c.talent_b) ?? "?"}) {jam(c.start_b)}–{jam(c.end_b)}</div>
            </div>
            <span className="badge badge-alpha">Bentrok</span>
          </div>
        ))}
      </div>
    </section>
  );
}
