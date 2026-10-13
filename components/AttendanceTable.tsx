import { jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { Avatar } from "@/components/Avatar";

export type AttRow = {
  slot_id: string; talent_id: string; account_code: string; slot_date: string; start_at: string; end_at: string;
  state: string; jam_absen: string | null; check_in_source: string | null; minutes_after_slot_start: number | null;
  live_minutes: number; session_count: number; override_note: string | null; is_event: boolean;
  change_kind?: "tidak_sesuai" | "tukar_shift" | "pindah_jadwal" | null; change_unauthorized?: boolean | null; change_note?: string | null;
  change_original_talent_id?: string | null; change_original_start_at?: string | null; change_original_end_at?: string | null;
  change_actual_start_at?: string | null; change_actual_end_at?: string | null;
  flag_live_di_jam_lain?: boolean | null; flag_diisi_talent_lain?: boolean | null;
  change_permitted_by?: string | null; change_reported_by?: string | null;
};

export function izinLabel(reportedBy?: string | null, permittedBy?: string | null, unauthorized?: boolean | null) {
  if (reportedBy === "data_live") return "disesuaikan dari data live";
  if (permittedBy) return `izin ${permittedBy}`;
  if (unauthorized) return "tanpa izin";
  return "";
}

export const CHANGE_LABEL: Record<string, string> = {
  tidak_sesuai: "Tidak sesuai jadwal", tukar_shift: "Tukar shift", pindah_jadwal: "Pindah jadwal",
};

/** Pil + keterangan kesesuaian jadwal untuk satu slot. */
function ChangeInfo({ r, names }: { r: AttRow; names?: Map<string, string> }) {
  if (r.change_kind) {
    const k = r.change_kind;
    let desc = "";
    if (k === "tidak_sesuai" && r.change_actual_start_at) {
      desc = `Masuk ${jam(r.change_actual_start_at)}${r.change_actual_end_at ? `–${jam(r.change_actual_end_at)}` : ""}, jadwal ${jam(r.start_at)}–${jam(r.end_at)}`;
    } else if (k === "tukar_shift") {
      desc = `Menggantikan ${names?.get(r.change_original_talent_id ?? "") ?? "talent lain"}`;
    } else if (k === "pindah_jadwal" && r.change_original_start_at) {
      desc = `Dipindah dari ${tanggalPendek(r.change_original_start_at)}, ${jam(r.change_original_start_at)}–${jam(r.change_original_end_at)}`;
    }
    return (
      <div className="chg">
        <span className={`badge chg-${k}`}>{CHANGE_LABEL[k]}</span>
        {izinLabel(r.change_reported_by, r.change_permitted_by, r.change_unauthorized) && (
          <span className={`badge ${r.change_unauthorized ? "badge-alpha" : "badge-hadir"}`}>{izinLabel(r.change_reported_by, r.change_permitted_by, r.change_unauthorized)}</span>
        )}
        {desc && <span className="s">{desc}</span>}
        {r.change_note && <span className="s">{r.change_note}</span>}
      </div>
    );
  }
  if (r.flag_live_di_jam_lain || r.flag_diisi_talent_lain) {
    return (
      <div className="chg">
        {r.flag_live_di_jam_lain && <span className="badge chg-auto">Live di jam lain?</span>}
        {r.flag_diisi_talent_lain && <span className="badge chg-auto">Diisi talent lain?</span>}
      </div>
    );
  }
  return null;
}

export const STATUS_LABEL: Record<string, string> = {
  terjadwal: "Terjadwal", hadir: "Hadir", izin: "Izin", alpha: "Tidak hadir", telat: "Telat",
};

function keterangan(r: AttRow) {
  if (r.minutes_after_slot_start === null) return "";
  const m = r.minutes_after_slot_start;
  if (m < 0) return `${-m} mnt sebelum slot`;
  if (m === 0) return "tepat saat slot dibuka";
  return `${m} mnt setelah slot dibuka`;
}

/** Daftar absensi 2 baris: siapa/akun di atas, detail di bawah, status di kanan. */
export function AttendanceTable({ rows, accName, nick, names, action }: {
  rows: AttRow[]; accName: Map<string, string>; nick?: Map<string, string>; names?: Map<string, string>;
  action?: (r: AttRow) => React.ReactNode;
}) {
  if (!rows.length) return <div className="empty"><strong>Belum ada slot</strong>Tidak ada jadwal di periode ini.</div>;
  return (
    <div className="list">
      {rows.map((r) => {
        const akun = accName.get(r.account_code) ?? r.account_code;
        const title = nick ? nick.get(r.talent_id) ?? "?" : akun;
        const detail = [
          nick ? akun : null,
          `${tanggalPendek(r.slot_date)}, ${jam(r.start_at)}–${jam(r.end_at)}${r.is_event ? " (event)" : ""}`,
          r.jam_absen ? `absen ${r.jam_absen} ${r.check_in_source === "aplikasi" ? "lewat tombol" : "dari data live"}` : null,
        ].filter(Boolean).join(", ");
        return (
          <div key={r.slot_id} className="li">
            <Avatar name={title} />
            <div>
              <div className="t">{title}</div>
              <div className="s">{detail}</div>
              {(keterangan(r) || r.override_note) && (
                <div className="s">{keterangan(r)}{r.override_note ? `${keterangan(r) ? ". " : ""}Dikoreksi: ${r.override_note}` : ""}</div>
              )}
              <ChangeInfo r={r} names={names ?? nick} />
            </div>
            <div className="r">
              <span className={`badge badge-${r.state}`}>{STATUS_LABEL[r.state] ?? r.state}</span>
              {r.live_minutes > 0 && <span className="s">{menitKeJam(r.live_minutes)} live</span>}
            </div>
            {action && action(r)}
          </div>
        );
      })}
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
