import { jam, menitKeJam, tanggalPendek } from "@/lib/time";

export type SessionRow = {
  id: string; session_date: string; started_at: string | null; duration_minutes: number | null; account_code: string;
  platform: string; total_views: number | null; unique_viewers: number | null; peak_concurrent: number | null;
  avg_watch_seconds: number | null; topic: string | null; review_status: string; talent_id: string | null;
};

const n = (v: number | null) => (v === null ? "–" : new Intl.NumberFormat("id-ID").format(v));

export function SessionTable({ rows, accName, nick }: { rows: SessionRow[]; accName: Map<string, string>; nick?: Map<string, string> }) {
  if (!rows.length) return <div className="empty"><strong>Belum ada data live</strong>Data yang kamu simpan akan muncul di sini.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>{nick && <th>Talent</th>}<th>Akun</th><th>Mulai</th><th className="num">Durasi</th>
            <th className="num">Tayangan</th><th className="num">Penonton unik</th><th className="num">Puncak</th><th>Materi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nw">{tanggalPendek(r.session_date)}{r.review_status === "needs_review" && <> <span className="badge badge-pending">Perlu dicek</span></>}</td>
              {nick && <td>{r.talent_id ? nick.get(r.talent_id) ?? "?" : "–"}</td>}
              <td>{accName.get(r.account_code) ?? r.account_code}{r.platform === "instagram" ? " (IG)" : ""}</td>
              <td>{jam(r.started_at)}</td>
              <td className="num">{r.duration_minutes ? menitKeJam(r.duration_minutes) : "–"}</td>
              <td className="num">{n(r.total_views)}</td>
              <td className="num">{n(r.unique_viewers)}</td>
              <td className="num">{n(r.peak_concurrent)}</td>
              <td className="small">{r.topic ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
