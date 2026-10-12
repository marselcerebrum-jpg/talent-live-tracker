type Point = { label: string; value: number };

/** Grafik batang SVG ringan, dirender di server. */
export function BarChart({ data, title, unit = "", height = 180, highlightMax = true }: {
  data: Point[]; title: string; unit?: string; height?: number; highlightMax?: boolean;
}) {
  const W = 720, H = height, padL = 44, padB = 26, padT = 10;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const bw = (W - padL - 8) / Math.max(1, data.length);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const maxIdx = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  const every = Math.ceil(data.length / 10);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Tertinggi ${fmt(data[maxIdx]?.value ?? 0)}${unit} pada ${data[maxIdx]?.label ?? "-"}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="tick">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (H - padT - padB) * (d.value / nice);
          return (
            <g key={d.label}>
              <rect
                x={padL + i * bw + bw * 0.15} y={y(d.value)} width={Math.max(1, bw * 0.7)} height={Math.max(0, h)} rx={2}
                className={highlightMax && i === maxIdx && d.value > 0 ? "bar bar-max" : "bar"}
              ><title>{`${d.label}: ${fmt(d.value)}${unit}`}</title></rect>
              {i % every === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="tick">{d.label}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10;
  return step * p;
}
const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const short = (n: number) => (n >= 1000 ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n / 1000)}rb` : fmt(n));
