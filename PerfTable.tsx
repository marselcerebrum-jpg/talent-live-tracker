import { fmtNum, type Agg } from "@/lib/perf";
import { menitKeJam } from "@/lib/time";

export function PerfTable({ rows, label, name }: { rows: Agg[]; label: string; name: (key: string) => string }) {
  if (!rows.length) return <p className="muted">Belum ada data di periode ini.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{label}</th><th className="num">Sesi</th><th className="num">Total live</th>
            <th className="num key">Tayangan per jam</th><th className="num">Rata-rata tayangan</th>
            <th className="num">Rata-rata puncak</th><th className="num">Median tonton</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td><strong>{name(r.key)}</strong></td>
              <td className="num">{r.sesi}</td>
              <td className="num">{menitKeJam(r.menit)}</td>
              <td className="num key">{fmtNum(r.viewsPerHour)}</td>
              <td className="num">{fmtNum(r.avgViews)}</td>
              <td className="num">{fmtNum(r.avgPeak, 1)}</td>
              <td className="num">{r.medianWatch === null ? "–" : `${fmtNum(r.medianWatch)} dtk`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
