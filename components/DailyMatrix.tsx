import { fmtNum, type PerfRow } from "@/lib/perf";
import { menitKeJam, tanggalPendek } from "@/lib/time";

type Cell = { views: number; menit: number; peak: number; sesi: number };

/** Tabel performa harian: baris = tanggal, kolom = talent atau aplikasi. */
export function DailyMatrix({ rows, keyOf, nameOf, emptyText }: {
  rows: PerfRow[]; keyOf: (r: PerfRow) => string | null; nameOf: (k: string) => string; emptyText?: string;
}) {
  const grid = new Map<string, Map<string, Cell>>();
  const totals = new Map<string, Cell>();
  const add = (m: Map<string, Cell>, k: string, r: PerfRow) => {
    const c = m.get(k) ?? { views: 0, menit: 0, peak: 0, sesi: 0 };
    c.views += r.platform === "tiktok" ? r.total_views ?? 0 : 0;
    c.menit += r.duration_minutes ?? 0;
    c.peak = Math.max(c.peak, r.peak_concurrent ?? 0);
    c.sesi += 1;
    m.set(k, c);
  };
  rows.forEach((r) => {
    const k = keyOf(r);
    if (!k) return;
    const day = grid.get(r.session_date) ?? new Map<string, Cell>();
    add(day, k, r); add(day, "__total", r);
    grid.set(r.session_date, day);
    add(totals, k, r);
  });
  const cols = [...totals.entries()].sort((a, b) => b[1].views - a[1].views).map(([k]) => k);
  const days = [...grid.keys()].sort().reverse();
  if (!days.length) return <div className="empty"><strong>Belum ada data live</strong>{emptyText ?? "Tidak ada sesi di periode ini."}</div>;

  const CellView = ({ c }: { c?: Cell }) =>
    !c ? <span className="muted">–</span> : (
      <div>
        <strong style={{ fontFamily: "var(--disp)" }}>{fmtNum(c.views)}</strong>
        <div className="s" style={{ fontSize: ".78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{menitKeJam(c.menit)}, puncak {fmtNum(c.peak)}</div>
      </div>
    );

  return (
    <div className="table-wrap" style={{ margin: 0, padding: "0 20px" }}>
      <table className="daily">
        <thead>
          <tr>
            <th className="sticky">Tanggal</th>
            {cols.map((k) => <th key={k} className="num">{nameOf(k)}</th>)}
            <th className="num key">Total</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const row = grid.get(d)!;
            return (
              <tr key={d}>
                <td className="nw sticky">{tanggalPendek(d)}</td>
                {cols.map((k) => <td key={k} className="num"><CellView c={row.get(k)} /></td>)}
                <td className="num key"><CellView c={row.get("__total")} /></td>
              </tr>
            );
          })}
          <tr>
            <td className="sticky"><strong>Total</strong></td>
            {cols.map((k) => <td key={k} className="num key"><CellView c={totals.get(k)} /></td>)}
            <td className="num key"><CellView c={[...totals.values()].reduce((a, c) => ({ views: a.views + c.views, menit: a.menit + c.menit, peak: Math.max(a.peak, c.peak), sesi: a.sesi + c.sesi }), { views: 0, menit: 0, peak: 0, sesi: 0 })} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
