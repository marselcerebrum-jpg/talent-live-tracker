import { jam, menitKeJam, tanggalPendek } from "@/lib/time";
import { Avatar } from "@/components/Avatar";

export type SessionRow = {
  id: string; session_date: string; started_at: string | null; duration_minutes: number | null; account_code: string;
  platform: string; total_views: number | null; unique_viewers: number | null; peak_concurrent: number | null;
  avg_watch_seconds: number | null; topic: string | null; review_status: string; talent_id: string | null;
};

const n = (v: number | null) => (v === null ? "–" : new Intl.NumberFormat("id-ID").format(v));

/** Daftar sesi live 2 baris. */
export function SessionTable({ rows, accName, nick }: { rows: SessionRow[]; accName: Map<string, string>; nick?: Map<string, string> }) {
  if (!rows.length) return <div className="empty"><strong>Belum ada data live</strong>Data yang disimpan akan muncul di sini.</div>;
  return (
    <div className="list">
      {rows.map((r) => {
        const akun = `${accName.get(r.account_code) ?? r.account_code}${r.platform === "instagram" ? " (IG)" : ""}`;
        const title = nick ? (r.talent_id ? nick.get(r.talent_id) ?? "?" : "Tanpa talent") : akun;
        const detail = [nick ? akun : null, `${tanggalPendek(r.session_date)}, mulai ${jam(r.started_at)}`, r.topic].filter(Boolean).join(", ");
        return (
          <div key={r.id} className="li">
            <Avatar name={title} />
            <div>
              <div className="t">{title}{r.review_status === "needs_review" && <> <span className="badge badge-pending">Perlu dicek</span></>}</div>
              <div className="s">{detail}</div>
              <div className="s">{n(r.total_views)} tayangan, {n(r.unique_viewers)} penonton unik, puncak {n(r.peak_concurrent)}</div>
            </div>
            <div className="r">
              <span className="badge">{r.duration_minutes ? menitKeJam(r.duration_minutes) : "–"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
