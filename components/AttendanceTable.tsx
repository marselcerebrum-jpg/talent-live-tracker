import { jam, menitKeJam, tanggalPendek } from "@/lib/time";

export type AttRow = {
  slot_id: string; talent_id: string; account_code: string; slot_date: string; start_at: string; end_at: string;
  state: string; jam_absen: string | null; check_in_source: string | null; minutes_after_slot_start: number | null;
  live_minutes: number; session_count: number; override_note: string | null; is_event: boolean;
};

export const STATUS_LABEL: Record<string, string> = {
  terjadwal: "Terjadwal", hadir: "Hadir", izin: "Izin", alpha: "Tidak hadir", telat: "Telat",
};

function keterangan(r: AttRow) {
  if (r.minutes_after_slot_start === null) return "";
  const m = r.minutes_after_slot_start;
  if (m < 0) return `${-m} mnt sebelum slot dibuka`;
  if (m === 0) return "tepat saat slot dibuka";
  return `${m} mnt setelah slot dibuka`;
}

export function AttendanceTable({ rows, accName, nick, action }: {
  rows: AttRow[]; accName: Map<string, string>; nick?: Map<string, string>;
  action?: (r: AttRow) => React.ReactNode;
}) {
  if (!rows.length) return <div className="empty"><strong>Belum ada slot di periode ini</strong>Pilih periode lain.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>{nick && <th>Talent</th>}<th>Akun</th><th>Slot</th><th>Status</th>
            <th>Jam absen</th><th>Keterangan</th><th className="num">Live</th>{action && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slot_id}>
              <td className="nw">{tanggalPendek(r.slot_date)}</td>
              {nick && <td>{nick.get(r.talent_id) ?? "?"}</td>}
              <td>{accName.get(r.account_code) ?? r.account_code}{r.is_event ? " (event)" : ""}</td>
              <td className="nw">{jam(r.start_at)}–{jam(r.end_at)}</td>
              <td>
                <span className={`badge badge-${r.state}`}>{STATUS_LABEL[r.state] ?? r.state}</span>
                {r.override_note && <div className="small muted">Dikoreksi: {r.override_note}</div>}
              </td>
              <td>
                {r.jam_absen ?? "–"}
                {r.check_in_source && <div className="small muted">{r.check_in_source === "aplikasi" ? "dari tombol absen" : "dari data live"}</div>}
              </td>
              <td className="small">{keterangan(r)}</td>
              <td className="num">{r.live_minutes ? menitKeJam(r.live_minutes) : "–"}</td>
              {action && <td>{action(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function monthRange(m?: string) {
  const ok = m && /^\d{4}-\d{2}$/.test(m) ? m : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
  const [y, mo] = ok.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 15)));
  return { month: ok, start: `${ok}-01`, end: `${ok}-${String(last).padStart(2, "0")}`, prev, next, label };
}
