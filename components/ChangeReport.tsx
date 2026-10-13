import { jam, tanggalPendek } from "@/lib/time";
import { Avatar } from "@/components/Avatar";
import { CHANGE_LABEL, izinLabel } from "@/components/AttendanceTable";

export type ChangeRow = {
  id: number; kind: string; reported_by: string; note: string | null; unauthorized: boolean; created_at: string; permitted_by: string | null;
  original_talent_id: string; new_talent_id: string | null;
  original_start_at: string; original_end_at: string; new_start_at: string | null; new_end_at: string | null;
  actual_start_at: string | null; slot: { account_code: string; talent_id: string } | null;
};

/** Laporan perubahan jadwal (dari talent maupun admin), terbaru di atas. */
export function ChangeReport({ rows, nick, accName, empty }: { rows: ChangeRow[]; nick: Map<string, string>; accName: Map<string, string>; empty: string }) {
  if (!rows.length) return <p className="muted" style={{ padding: 20 }}>{empty}</p>;
  return (
    <div className="list">
      {rows.map((c) => {
        const who = nick.get(c.kind === "tukar_shift" ? c.new_talent_id ?? "" : c.original_talent_id) ?? "?";
        const akun = accName.get(c.slot?.account_code ?? "") ?? c.slot?.account_code ?? "";
        let what = "";
        if (c.kind === "tukar_shift") what = `menggantikan ${nick.get(c.original_talent_id) ?? "?"} di ${akun} ${tanggalPendek(c.original_start_at)}, ${jam(c.original_start_at)}–${jam(c.original_end_at)}`;
        if (c.kind === "pindah_jadwal") what = `memindah ${akun} ${tanggalPendek(c.original_start_at)} ${jam(c.original_start_at)}–${jam(c.original_end_at)} ke ${tanggalPendek(c.new_start_at!)} ${jam(c.new_start_at)}–${jam(c.new_end_at)}`;
        if (c.kind === "tidak_sesuai") what = `live di ${akun} pukul ${jam(c.actual_start_at)}, jadwalnya ${jam(c.original_start_at) === jam(c.actual_start_at) ? "tidak ada" : `${jam(c.original_start_at)}–${jam(c.original_end_at)}`}`;
        return (
          <div key={c.id} className="li">
            <Avatar name={who} />
            <div>
              <div className="t">{who} <span className="s">{what}</span></div>
              {c.note && <div className="s">Alasan: {c.note}</div>}
              <div className="s">{c.reported_by === "data_live" ? "Disesuaikan otomatis dari data live" : `Dilaporkan ${c.reported_by === "talent" ? "talent" : "admin"}`}, {tanggalPendek(c.created_at)} {jam(c.created_at)}</div>
            </div>
            <div className="r">
              <span className={`badge chg-${c.kind}`}>{CHANGE_LABEL[c.kind]}</span>
              {izinLabel(c.reported_by, c.permitted_by, c.unauthorized) && (
                <span className={`badge ${c.unauthorized ? "badge-alpha" : "badge-hadir"}`}>{izinLabel(c.reported_by, c.permitted_by, c.unauthorized)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
